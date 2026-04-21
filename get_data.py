import argparse
import json
import logging
import pandas as pd
import requests
if __package__:
    from .retriver import parse_with_gemini, scrape_importyeti, sec_edgar_lookup, fetch_sec_filing_content
else:
    from retriver import (
        parse_with_gemini,
        scrape_importyeti,
        sec_edgar_lookup,
        fetch_sec_filing_content
    )
import os
import re
import time
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any

try:
    from google import genai as google_genai
except Exception:
    google_genai = None

# Set up logging for CLI execution
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
BOM_PATH = BASE_DIR / "bom_tree.json"
STORE_PATH = BASE_DIR / "company_graph_store.json"
CIK_PATH = BASE_DIR / "company_cik.csv"
SDN_PATH = BASE_DIR / "flagdata" / "sdn_companies_only.csv"
WEATHER_API_KEY = "72d38df530dc4fb694c54550261904"

HSN_PATTERN = re.compile(r"\b(?:\d{4}(?:\.\d{1,2}(?:\.\d+)?)?|\d{6,10})\b")
STORE_LOCK = Lock()

DEFAULT_BOM_TREE = {
    "8703": ["8708", "8544", "4011", "7208", "7225", "8501", "8507", "8482", "8407"],
    "8708": ["7208", "7225", "7606", "4016"],
    "8544": ["7408", "3926", "7606", "4016"],
    "7408": ["7403"],
    "7403": ["2603"],
    "8507": ["2803", "2825", "2603"],
    "4011": ["4001", "4002"],
    "7225": ["2601", "7201", "7202", "7203"],
    "7403.11": ["2603"],
}


COUNTRY_COORD_FALLBACK = {
    "united states": (39.8283, -98.5795),
    "usa": (39.8283, -98.5795),
    "japan": (36.2048, 138.2529),
    "china": (35.8617, 104.1954),
    "south korea": (35.9078, 127.7669),
    "korea": (35.9078, 127.7669),
    "taiwan": (23.6978, 120.9605),
    "germany": (51.1657, 10.4515),
    "france": (46.2276, 2.2137),
    "canada": (56.1304, -106.3468),
    "india": (20.5937, 78.9629),
    "netherlands": (52.1326, 5.2913),
    "singapore": (1.3521, 103.8198),
    "brazil": (-14.2350, -51.9253),
    "australia": (-25.2744, 133.7751),
    "mexico": (23.6345, -102.5528),
    "chile": (-35.6751, -71.5430),
    "switzerland": (46.8182, 8.2275),
    "sweden": (60.1282, 18.6435),
    "denmark": (56.2639, 9.5018),
    "finland": (61.9241, 25.7482),
    "ireland": (53.1424, -7.6921),
    "belgium": (50.5039, 4.4699),
    "norway": (60.4720, 8.4689),
    "russia": (61.5240, 105.3188),
    "unknown": (35.0, 125.0),
}




def normalize_company_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def normalize_hsn(value: str | None) -> str:
    if not value:
        return ""
    raw = str(value).strip()
    digits_only = re.sub(r"\D", "", raw)
    if "." not in raw and len(digits_only) >= 6:
        base = f"{digits_only[:4]}.{digits_only[4:6]}"
        if len(digits_only) > 6:
            base = f"{base}.{digits_only[6:]}"
        return base
    if "." not in raw and len(digits_only) == 4:
        return digits_only
    digits = re.sub(r"[^0-9.]", "", raw)
    digits = re.sub(r"\.+", ".", digits).strip(".")
    return digits


def hsn_digits(value: str | None) -> str:
    return re.sub(r"\D", "", normalize_hsn(value))


def hsn_prefix(value: str | None, n: int = 4) -> str:
    return hsn_digits(value)[:n]


def slugify(value: str) -> str:
    raw = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return raw or "node"


def extract_hsn_candidates(text: str | None) -> list[str]:
    if not text:
        return []
    out = []
    for match in HSN_PATTERN.findall(text):
        code = normalize_hsn(match)
        if code:
            out.append(code)
    # Fallback: pick raw digit runs (e.g., 851713) if not caught above.
    for match in re.findall(r"\b\d{4,10}\b", text):
        code = normalize_hsn(match)
        if code:
            out.append(code)
    return out


class BomTree:
    def __init__(self, path: Path):
        self.path = path
        self.tree = self._load_tree()

    def _load_tree(self) -> dict[str, list[str]]:
        if self.path.exists():
            try:
                raw = json.loads(self.path.read_text(encoding="utf-8"))
                return self._normalize_tree(raw)
            except Exception as e:
                logger.warning("Failed to load bom_tree.json, using defaults. Error: %s", e)
        return self._normalize_tree(DEFAULT_BOM_TREE)

    @staticmethod
    def _normalize_tree(raw: dict[str, Any]) -> dict[str, list[str]]:
        normalized: dict[str, list[str]] = {}
        for k, vals in (raw or {}).items():
            key = normalize_hsn(k)
            if not key:
                continue
            clean_vals: list[str] = []
            for v in vals or []:
                code = normalize_hsn(v)
                if code:
                    clean_vals.append(code)
            normalized[key] = clean_vals
        return normalized

    def get_valid_inputs(self, parent_hsn: str) -> list[str]:
        parent = normalize_hsn(parent_hsn)
        if not parent:
            return []

        if parent in self.tree:
            return self.tree[parent]

        p4 = hsn_prefix(parent, 4)
        if p4 in self.tree:
            return self.tree[p4]

        return []

    def is_match(self, parent_hsn: str, child_hsn: str) -> bool:
        valid = self.get_valid_inputs(parent_hsn)
        if not valid:
            return False
        child4 = hsn_prefix(child_hsn, 4)
        return any(hsn_prefix(v, 4) == child4 for v in valid)


class LocationResolver:
    def __init__(self):
        self._cache: dict[str, tuple[float, float]] = {}

    def resolve(self, address: str | None, country: str | None) -> tuple[float, float]:
        """Resolves a full address or country to coordinates using Gemini."""
        query = address if (address and len(address) > 10) else country or "Unknown"
        key = normalize_company_name(query)
        if key in self._cache:
            return self._cache[key]

        lat_lng = self._resolve_with_llm(query)
        if lat_lng is None:
            lat_lng = self._resolve_fallback(country or "Unknown")
        self._cache[key] = lat_lng
        return lat_lng

    def _resolve_with_llm(self, query: str) -> tuple[float, float] | None:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key or not google_genai:
            return None

        prompt = (
            "Return only JSON with keys latitude and longitude for this location. "
            "Be as specific as possible if a street address is provided. "
            f"Location: {query}\n"
            '{"latitude": <float>, "longitude": <float>}'
        )

        try:
            client = google_genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )
            data = json.loads(response.text)
            lat = float(data.get("latitude"))
            lng = float(data.get("longitude"))
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return (lat, lng)
        except Exception:
            return None
        return None

    def _resolve_fallback(self, country: str) -> tuple[float, float]:
        key = normalize_company_name(country)
        if key in COUNTRY_COORD_FALLBACK:
            return COUNTRY_COORD_FALLBACK[key]
        return COUNTRY_COORD_FALLBACK["unknown"]


class RiskAssessor:
    def __init__(self):
        self._sdn_df = None
        self._cik_df = None

    def _load_data(self):
        if self._sdn_df is None:
            try:
                self._sdn_df = pd.read_csv(SDN_PATH)
            except Exception as e:
                logger.error("Failed to load SDN list: %s", e)
                self._sdn_df = pd.DataFrame(columns=["Company Name"])
        if self._cik_df is None:
            try:
                self._cik_df = pd.read_csv(CIK_PATH)
            except Exception as e:
                logger.error("Failed to load CIK map: %s", e)
                self._cik_df = pd.DataFrame(columns=["company_name", "cik"])

    def get_risk_scores(self, company_name: str, lat: float, lng: float) -> dict[str, Any]:
        self._load_data()
        
        sdn_res = self._check_sdn(company_name)
        sec_res = self._check_financials(company_name)
        weather_res = self._check_weather(lat, lng)
        
        scores = {
            "sdn_score": sdn_res["score"],
            "financial_score": sec_res["score"],
            "weather_score": weather_res["score"],
            "weather_text": weather_res["text"],
            "financial_notes": sec_res["notes"],
            "sdn_notes": sdn_res["notes"]
        }
        
        scores["combined_score"] = round((scores["sdn_score"] + scores["financial_score"] + scores["weather_score"]) / 3, 1)
        return scores

    def _check_sdn(self, company_name: str) -> dict:
        self._load_data()
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key or not google_genai:
            return {"score": 0, "notes": "Fuzzy SDN check unavailable"}

        # Optimization: subset for LLM
        potential = self._sdn_df[self._sdn_df['Company Name'].str.contains(company_name[:4], case=False, na=False)]
        list_sample = potential['Company Name'].unique().tolist()[:15]
        
        prompt = f"""
        Is the company "{company_name}" on this list of sanctioned entities? 
        List: {list_sample}
        Return JSON with "sanctioned" (bool), "confidence" (0-100), and "notes" (string).
        If matched, score is 100, else 0.
        """
        try:
            client = google_genai.Client(api_key=api_key)
            resp = client.models.generate_content(
                model="gemini-2.0-flash", contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            data = json.loads(resp.text)
            return {
                "score": 100 if data.get("sanctioned") else 0,
                "notes": data.get("notes", "No sanctions found.")
            }
        except:
            return {"score": 0, "notes": "Fuzzy check failed."}

    def _check_financials(self, company_name: str) -> dict:
        self._load_data()
        api_key = os.environ.get("GOOGLE_API_KEY")
        row = self._cik_df[self._cik_df['company_name'].str.lower() == company_name.lower()]
        if row.empty or not api_key:
            return {"score": 0, "notes": "No CIK or LLM available for financial assessment."}
        
        cik = str(row.iloc[0]['cik'])
        meta = sec_edgar_lookup(cik)
        filings = meta.get("recent_filings", [])[:3] # Analyze top 3 for speed/cost
        
        all_text = ""
        for f in filings:
            content = fetch_sec_filing_content(cik, f["accessionNumber"], f["primaryDocument"])
            all_text += f"\n--- {f['form']} ({f['date']}) ---\n{content}\n"

        prompt = f"""
        Analyze these SEC filings for "{company_name}" to estimate financial risk (debt, profit, etc.).
        Text: {all_text[:30000]}
        Return JSON with "risk_score" (0-100) and "brief_assessment" (string).
        """
        try:
            client = google_genai.Client(api_key=api_key)
            resp = client.models.generate_content(
                model="gemini-2.0-flash", contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            data = json.loads(resp.text)
            return {"score": data.get("risk_score", 50), "notes": data.get("brief_assessment", "N/A")}
        except:
            return {"score": 0, "notes": "Financial analysis failed."}

    def _check_weather(self, lat: float, lng: float) -> dict:
        try:
            url = f"https://api.weatherapi.com/v1/current.json?key={WEATHER_API_KEY}&q={lat},{lng}"
            r = requests.get(url, timeout=10)
            data = r.json()
            cond = data.get("current", {}).get("condition", {}).get("text", "Unknown")
            temp = data.get("current", {}).get("temp_c", "N/A")
            
            # Simple general risk assessment logic
            risk = 0
            if "storm" in cond.lower() or "typhoon" in cond.lower() or "hurricane" in cond.lower():
                risk = 80
            elif "rain" in cond.lower() or "snow" in cond.lower():
                risk = 20
            
            return {
                "score": risk,
                "text": f"Current: {cond}, {temp}C. Climate risk level: {risk}/100"
            }
        except:
            return {"score": 0, "text": "Weather data unavailable."}




class GraphStore:
    def __init__(self, path: Path):
        self.path = path

    def _load(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
            return []
        except Exception:
            return []

    def _save(self, records: list[dict[str, Any]]) -> None:
        self.path.write_text(json.dumps(records, indent=2), encoding="utf-8")

    def lookup(self, company_name: str, anchor_hsn: str | None, max_tier: int, limit: int) -> dict[str, Any] | None:
        company_key = normalize_company_name(company_name)
        anchor_norm = normalize_hsn(anchor_hsn) if anchor_hsn else ""
        coord_resolver = LocationResolver()

        with STORE_LOCK:
            records = self._load()

        for rec in records:
            if rec.get("company_key") != company_key:
                continue
            if rec.get("max_tier") != max_tier:
                continue
            if rec.get("limit") != limit:
                continue

            rec_anchor = normalize_hsn(rec.get("selected_anchor_hsn", ""))
            if anchor_norm and rec_anchor != anchor_norm:
                continue

            payload = rec.get("payload")
            if payload:
                # Auto-heal stale root-only cache entries produced when HSN extraction failed.
                nodes = payload.get("nodes", [])
                edges = payload.get("edges", [])
                hsn_options = payload.get("hsn_options", [])
                selected_anchor = normalize_hsn(payload.get("selected_anchor_hsn", ""))
                if len(nodes) <= 1 and len(edges) == 0 and not hsn_options and not selected_anchor:
                    continue

                # Auto-enrich old cached records with coordinates.
                changed = False
                for n in nodes:
                    if "Latitude" not in n or "Longitude" not in n:
                        lat, lng = coord_resolver.resolve(n.get("Address"), n.get("Country") or "Unknown")
                        n["Latitude"] = lat
                        n["Longitude"] = lng
                        changed = True
                if changed:
                    rec["payload"] = payload
                return deepcopy(payload)

        return None

    def upsert(self, company_name: str, payload: dict[str, Any], max_tier: int, limit: int) -> None:
        company_key = normalize_company_name(company_name)
        selected_anchor = normalize_hsn(payload.get("selected_anchor_hsn", ""))

        record = {
            "company_key": company_key,
            "company_input": company_name,
            "selected_anchor_hsn": selected_anchor,
            "max_tier": max_tier,
            "limit": limit,
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "payload": payload,
        }

        with STORE_LOCK:
            records = self._load()
            replaced = False
            for idx, rec in enumerate(records):
                if (
                    rec.get("company_key") == company_key
                    and normalize_hsn(rec.get("selected_anchor_hsn", "")) == selected_anchor
                    and rec.get("max_tier") == max_tier
                    and rec.get("limit") == limit
                ):
                    records[idx] = record
                    replaced = True
                    break
            if not replaced:
                records.append(record)
            self._save(records)


class GraphBuilder:
    def __init__(self, coord_resolver: LocationResolver | None = None):
        self.top_products: list[str] = []
        self.hsn_options: list[str] = []
        self.nodes: list[dict[str, Any]] = []
        self.edges: list[dict[str, Any]] = []
        self._node_seq = 0
        self._name_counts: dict[str, int] = {}
        self.coord_resolver = coord_resolver or LocationResolver()

    def add_node(
        self,
        name: str,
        tier: int,
        *,
        country: str | None = None,
        address: str | None = None,
        category: str | None = None,
        description: str | None = None,
        source: str | None = None,
        confidence: str | None = None,
        risk_scores: dict[str, Any] | None = None,
    ) -> str:
        base = name.strip() or "Unknown Company"
        self._name_counts[base] = self._name_counts.get(base, 0) + 1
        count = self._name_counts[base]

        if count == 1:
            display_name = base
        else:
            display_name = f"{base} ({count})"

        self._node_seq += 1
        node_id = f"{slugify(base)}-{self._node_seq}"
        lat, lng = self.coord_resolver.resolve(address, country or "Unknown")

        self.nodes.append(
            {
                "Company Name": display_name,
                "Canonical Company Name": base,
                "Node ID": node_id,
                "Country": country or "Unknown",
                "Address": address or "N/A",
                "Latitude": lat,
                "Longitude": lng,
                "Product Category": category or "N/A",
                "Company Description": description or "A supplier involved in the supply chain.",
                "Tier": tier,
                "Source": source or "unknown",
                "Confidence": confidence or "low",
                "Risk Assessment": risk_scores or {},
            }
        )
        return display_name

    def add_edge(
        self,
        source: str,
        target: str,
        *,
        product: str,
        description: str,
        hsn: str,
        route: str,
        source_label: str | None = None,
        confidence: str | None = None,
        prune_reason: str | None = None,
    ) -> None:
        self.edges.append(
            {
                "Company1": source,
                "Company2": target,
                "Product": product,
                "Product Description": description,
                "HSN Code of Products": normalize_hsn(hsn) or "N/A",
                "Possible Shipment Route": route or "N/A",
                "Source": source_label or "unknown",
                "Confidence": confidence or "low",
                "Prune Reason": prune_reason or "",
            }
        )

    def to_json(self, selected_anchor_hsn: str) -> dict[str, Any]:
        return {
            "top_products": self.top_products,
            "hsn_options": self.hsn_options,
            "selected_anchor_hsn": normalize_hsn(selected_anchor_hsn),
            "nodes": self.nodes,
            "edges": self.edges,
        }


class BomRecursivePipeline:
    def __init__(self, bom_tree: BomTree):
        self.bom_tree = bom_tree
        self.scrape_cache: dict[str, dict[str, Any]] = {}
        self._cik_df = None

    def _fetch_company_snapshot(self, company_name: str) -> dict[str, Any]:
        key = normalize_company_name(company_name)
        if key in self.scrape_cache:
            return self.scrape_cache[key]

        try:
            html, _ = scrape_importyeti(company_name)
            data = parse_with_gemini(html, company_name) or {}
        except Exception as e:
            logger.warning("Scrape failed for %s. Falling back to LLM-only parse. Error: %s", company_name, e)
            data = parse_with_gemini("", company_name) or {}

        # Fallback for address if unavailable on Yeti
        fc = data.get("focus_company", {})
        if not fc.get("address"):
            if self._cik_df is None:
                try:
                    self._cik_df = pd.read_csv(CIK_PATH)
                except:
                    self._cik_df = pd.DataFrame()
            
            if not self._cik_df.empty:
                row = self._cik_df[self._cik_df['company_name'].str.lower() == company_name.lower()]
                if not row.empty:
                    cik = str(row.iloc[0]['cik'])
                    sec_meta = sec_edgar_lookup(cik)
                    if sec_meta.get("address"):
                        fc["address"] = sec_meta["address"]

        self.scrape_cache[key] = data
        return data

    def _collect_hsn_options(self, company_snapshot: dict[str, Any]) -> list[str]:
        found: list[str] = []

        for rel in company_snapshot.get("relationships", []) or []:
            edge = rel.get("edge", {})
            found.extend(extract_hsn_candidates(edge.get("hsn_code")))

        for item in company_snapshot.get("top_products", []) or []:
            found.extend(extract_hsn_candidates(str(item)))

        unique = []
        seen = set()
        for code in found:
            norm = normalize_hsn(code)
            if norm and norm not in seen:
                unique.append(norm)
                seen.add(norm)

        return unique

    def _candidate_from_relationship(self, rel: dict[str, Any], source: str, default_conf: str) -> dict[str, Any] | None:
        supplier = rel.get("supplier_node", {})
        edge = rel.get("edge", {})

        supplier_name = (supplier.get("name") or "").strip()
        if not supplier_name:
            return None

        edge_hsn = normalize_hsn(edge.get("hsn_code") or "")

        return {
            "name": supplier_name,
            "country": supplier.get("country") or "Unknown",
            "address": supplier.get("address") or "",
            "category": supplier.get("product_category") or "N/A",
            "description": supplier.get("description") or "",
            "product": edge.get("product") or "Various",
            "product_description": edge.get("product_description") or "N/A",
            "hsn": edge_hsn,
            "route": edge.get("shipment_route") or "N/A",
            "source": source,
            "confidence": default_conf,
        }

    def _gather_tier12_candidates(self, parent_company: str, limit: int) -> list[dict[str, Any]]:
        snapshot = self._fetch_company_snapshot(parent_company)
        relationships = snapshot.get("relationships", []) or []
        candidates = []
        for rel in relationships:
            cand = self._candidate_from_relationship(rel, source="cbp-reverse", default_conf="medium")
            if cand:
                candidates.append(cand)
        return candidates[: max(limit * 3, limit)]

    def _gather_tier3plus_candidates(
        self,
        parent_company: str,
        valid_inputs: list[str],
        limit: int,
    ) -> list[dict[str, Any]]:
        # No paid API dependency here: LLM-only structured fallback for deep tiers.
        snapshot = parse_with_gemini("", parent_company) or {}
        relationships = snapshot.get("relationships", []) or []
        candidates = []

        for rel in relationships:
            cand = self._candidate_from_relationship(rel, source="llm-fallback", default_conf="low")
            if not cand:
                continue
            if not cand["hsn"] and valid_inputs:
                cand["hsn"] = normalize_hsn(valid_inputs[0])
            if not cand["route"]:
                cand["route"] = "N/A"
            candidates.append(cand)

        # If LLM yields nothing at deep tiers, synthesize minimal placeholders from BOM inputs.
        if not candidates and valid_inputs:
            for idx, v in enumerate(valid_inputs[:limit], start=1):
                candidates.append(
                    {
                        "name": f"Unknown Supplier {idx} for {parent_company}",
                        "country": "Unknown",
                        "category": "Upstream input supplier",
                        "description": "Inferred from BOM expansion when direct supplier evidence is sparse.",
                        "product": f"Input for {parent_company}",
                        "product_description": "Inferred BOM input",
                        "hsn": normalize_hsn(v),
                        "route": "N/A",
                        "source": "bom-inferred",
                        "confidence": "low",
                    }
                )

        return candidates[: max(limit * 3, limit)]

    def _apply_bom_filter(
        self,
        parent_hsn: str,
        candidates: list[dict[str, Any]],
        *,
        tier: int,
        limit: int,
    ) -> list[dict[str, Any]]:
        valid_inputs = self.bom_tree.get_valid_inputs(parent_hsn)

        # Compatibility mode: if BOM has no mapping yet, keep early tiers alive.
        # Tier-3 is intentionally permissive to avoid dead-ends on sparse BOM seed data.
        if not valid_inputs:
            if tier <= 3:
                return candidates[:limit]
            return []

        filtered = []
        for cand in candidates:
            child_hsn = cand.get("hsn") or ""
            if not child_hsn:
                continue

            if self.bom_tree.is_match(parent_hsn, child_hsn):
                filtered.append(cand)

        return filtered[:limit]

    def build(
        self,
        company_name: str,
        *,
        anchor_hsn: str | None,
        max_tier: int,
        limit: int,
        risk_assessor: RiskAssessor | None = None,
    ) -> dict[str, Any]:
        graph = GraphBuilder()
        assessor = risk_assessor or RiskAssessor()

        root_snapshot = self._fetch_company_snapshot(company_name)
        graph.top_products = root_snapshot.get("top_products", []) or []
        graph.hsn_options = self._collect_hsn_options(root_snapshot)

        selected_anchor = normalize_hsn(anchor_hsn)
        if not selected_anchor:
            selected_anchor = graph.hsn_options[0] if graph.hsn_options else ""

        focus_company = root_snapshot.get("focus_company", {}) or {}
        
        # Resolve root coordinates and risks
        root_addr = focus_company.get("address")
        root_lat, root_lng = graph.coord_resolver.resolve(root_addr, focus_company.get("country"))
        root_risks = assessor.get_risk_scores(company_name, root_lat, root_lng)

        root_display = graph.add_node(
            name=company_name,
            tier=0,
            country=focus_company.get("country") or "Unknown",
            address=root_addr,
            category=focus_company.get("product_category") or "N/A",
            description=focus_company.get("description") or f"{company_name} root company.",
            source="user-input",
            confidence="anchor",
            risk_scores=root_risks,
        )

        if not selected_anchor:
            return graph.to_json("")

        def recurse(parent_display_name: str, parent_company: str, parent_hsn: str, tier: int) -> None:
            if tier > max_tier:
                return

            if tier <= 2:
                raw_candidates = self._gather_tier12_candidates(parent_company, limit)
            else:
                valid_inputs = self.bom_tree.get_valid_inputs(parent_hsn)
                raw_candidates = self._gather_tier3plus_candidates(parent_company, valid_inputs, limit)

            selected = self._apply_bom_filter(
                parent_hsn,
                raw_candidates,
                tier=tier,
                limit=limit,
            )

            for cand in selected:
                child_name = cand.get("name") or "Unknown Supplier"
                child_addr = cand.get("address")
                
                # Resolve child coordinates and risks
                child_lat, child_lng = graph.coord_resolver.resolve(child_addr, cand.get("country"))
                child_risks = assessor.get_risk_scores(child_name, child_lat, child_lng)

                child_display = graph.add_node(
                    name=child_name,
                    tier=tier,
                    country=cand.get("country") or "Unknown",
                    address=child_addr,
                    category=cand.get("category") or "N/A",
                    description=cand.get("description") or "",
                    source=cand.get("source") or "unknown",
                    confidence=cand.get("confidence") or "low",
                    risk_scores=child_risks,
                )

                child_hsn = normalize_hsn(cand.get("hsn") or "")
                graph.add_edge(
                    source=parent_display_name,
                    target=child_display,
                    product=cand.get("product") or "Various",
                    description=cand.get("product_description") or "N/A",
                    hsn=child_hsn or "N/A",
                    route=cand.get("route") or "N/A",
                    source_label=cand.get("source") or "unknown",
                    confidence=cand.get("confidence") or "low",
                )

                if child_hsn:
                    recurse(child_display, child_name, child_hsn, tier + 1)

        recurse(root_display, company_name, selected_anchor, tier=1)
        return graph.to_json(selected_anchor)

# ---------------------- legacy fallback (keep tier0-1 stable) ----------------------
class LegacyGlobalGraph:
    def __init__(self):
        self.top_products = []
        self.nodes = {}
        self.edges = []
        self.coord_resolver = LocationResolver()

    def add_node(self, name, tier, country=None, address=None, category=None, description=None, risk_scores=None):
        if name not in self.nodes:
            lat, lng = self.coord_resolver.resolve(address, country or "Unknown")
            self.nodes[name] = {
                "Company Name": name,
                "Country": country or "Unknown",
                "Address": address or "N/A",
                "Latitude": lat,
                "Longitude": lng,
                "Product Category": category or "N/A",
                "Company Description": description or "A supplier involved in the supply chain.",
                "Tier": tier,
                "Risk Assessment": risk_scores or {},
            }

    def add_edge(self, source, target, product, description, hsn, route):
        self.edges.append(
            {
                "Company1": source,
                "Company2": target,
                "Product": product,
                "Product Description": description,
                "HSN Code of Products": hsn,
                "Possible Shipment Route": route,
            }
        )

    def to_json(self):
        return {
            "top_products": self.top_products,
            "hsn_options": [],
            "selected_anchor_hsn": "",
            "nodes": list(self.nodes.values()),
            "edges": self.edges,
        }


def _legacy_explore_node(graph, parent_name: str, current_depth: int, max_depth: int, breadth_limit: int):
    if current_depth >= max_depth:
        return

    try:
        html, _ = scrape_importyeti(parent_name)
        gemini_data = parse_with_gemini(html, parent_name)
    except Exception:
        gemini_data = parse_with_gemini("", parent_name)

    if current_depth == 0:
        graph.top_products = gemini_data.get("top_products", [])

    f_company = gemini_data.get("focus_company", {})
    graph.add_node(
        name=parent_name,
        tier=current_depth,
        country=f_company.get("country"),
        category=f_company.get("product_category"),
        description=f_company.get("description"),
    )

    relationships = gemini_data.get("relationships", [])
    targets = relationships[:breadth_limit]

    for rel in targets:
        s_node = rel.get("supplier_node", {})
        s_edge = rel.get("edge", {})
        supplier_name = s_node.get("name")
        if not supplier_name:
            continue

        graph.add_node(
            name=supplier_name,
            tier=current_depth + 1,
            country=s_node.get("country"),
            category=s_node.get("product_category"),
            description=s_node.get("description"),
        )

        graph.add_edge(
            source=parent_name,
            target=supplier_name,
            product=s_edge.get("product", "Various"),
            description=s_edge.get("product_description", "N/A"),
            hsn=s_edge.get("hsn_code", "N/A"),
            route=s_edge.get("shipment_route", "N/A"),
        )

        _legacy_explore_node(graph, supplier_name, current_depth + 1, max_depth, breadth_limit)


def _legacy_get_supply_chain_data(company_name: str, depth: int = 2, limit: int = 3) -> dict[str, Any]:
    graph = LegacyGlobalGraph()
    _legacy_explore_node(graph, company_name, 0, depth, limit)
    return graph.to_json()


# ---------------------- public entrypoint ----------------------
def get_supply_chain_data(
    company_name: str,
    depth: int = 2,
    limit: int = 3,
    anchor_hsn: str | None = None,
    max_tier: int | None = None,
):
    effective_tier = max_tier if max_tier is not None else depth

    store = GraphStore(STORE_PATH)
    cached = store.lookup(company_name, anchor_hsn, effective_tier, limit)
    if cached is not None:
        return cached

    bom_tree = BomTree(BOM_PATH)
    pipeline = BomRecursivePipeline(bom_tree)

    try:
        data = pipeline.build(
            company_name,
            anchor_hsn=anchor_hsn,
            max_tier=effective_tier,
            limit=limit,
        )
    except Exception as e:
        logger.exception("New BOM pipeline failed, falling back to legacy flow. Error: %s", e)
        data = _legacy_get_supply_chain_data(company_name, depth=depth, limit=limit)

    store.upsert(company_name, data, effective_tier, limit)
    return data


def get_company_suppliers_slice(company_name: str, start: int = 0, end: int = 5) -> dict[str, Any]:
    """
    Fetches a specific slice of suppliers for a company.
    Used for incremental node expansion in the frontend.
    """
    bom_tree = BomTree(BOM_PATH)
    pipeline = BomRecursivePipeline(bom_tree)

    try:
        snapshot = pipeline._fetch_company_snapshot(company_name)
    except Exception as e:
        logger.warning("Failed to fetch snapshot for %s: %s", company_name, e)
        snapshot = {}

    relationships = snapshot.get("relationships", []) or []
    sliced_rels = relationships[start:end]

    graph = GraphBuilder()
    focus_company = snapshot.get("focus_company", {}) or {}

    root_display = graph.add_node(
        name=company_name,
        tier=0,  # Relative tier; frontend will adjust
        country=focus_company.get("country") or "Unknown",
        category=focus_company.get("product_category") or "N/A",
        description=focus_company.get("description") or f"{company_name} company details.",
        source="expansion",
        confidence="medium",
    )

    for rel in sliced_rels:
        cand = pipeline._candidate_from_relationship(rel, source="cbp-reverse", default_conf="medium")
        if not cand:
            continue

        child_name = cand.get("name") or "Unknown"
        child_display = graph.add_node(
            name=child_name,
            tier=1,
            country=cand.get("country") or "Unknown",
            category=cand.get("category") or "N/A",
            description=cand.get("description") or "",
            source=cand.get("source") or "unknown",
            confidence=cand.get("confidence") or "low",
        )

        graph.add_edge(
            source=root_display,
            target=child_display,
            product=cand.get("product") or "Various",
            description=cand.get("product_description") or "N/A",
            hsn=cand.get("hsn") or "N/A",
            route=cand.get("route") or "N/A",
            source_label=cand.get("source") or "unknown",
            confidence=cand.get("confidence") or "low",
        )

    return graph.to_json("")


def main():
    parser = argparse.ArgumentParser(description="Recursive Supply Chain Graph Builder")
    parser.add_argument("--company", required=True, help="Target company, e.g. 'Apple'")
    parser.add_argument("--depth", type=int, default=2, help="Recursion depth (default: 2)")
    parser.add_argument("--limit", type=int, default=3, help="Max suppliers to follow per level (default: 3)")
    parser.add_argument("--anchor-hsn", default=None, help="Optional anchor HSN selected by user")
    parser.add_argument("--max-tier", type=int, default=None, help="Optional max tier override")
    args = parser.parse_args()

    logger.info(
        "Building Recursive Graph for %s (Depth: %s, Limit: %s)",
        args.company,
        args.depth,
        args.limit,
    )

    start_time = time.time()
    data = get_supply_chain_data(
        args.company,
        depth=args.depth,
        limit=args.limit,
        anchor_hsn=args.anchor_hsn,
        max_tier=args.max_tier,
    )
    duration = time.time() - start_time
    logger.info("Graph construction complete in %.1fs", duration)

    out_path = f"{args.company.lower().replace(' ', '_')}_supply_chain_graph.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    logger.info("Graph saved to: %s", out_path)


if __name__ == "__main__":
    main()
