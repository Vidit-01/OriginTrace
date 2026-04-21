import argparse
import json
import os
import re
import time
import requests
from bs4 import BeautifulSoup
from rich.console import Console
from rich.table import Table

try:
    from google import genai
except ImportError:
    genai = None

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

console = Console()

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

KNOWN_COUNTRIES = {
    "China", "Hong Kong", "Vietnam", "Japan", "Taiwan", "South Korea",
    "India", "Mexico", "Germany", "Singapore", "Malaysia", "Thailand",
    "Indonesia", "Philippines", "United States", "United Arab Emirates",
    "Netherlands", "Czech Republic", "Hungary", "Brazil", "Ireland",
}

HTS_PATTERN = re.compile(r"^\d{4}\.\d{2}\.\d+")
COUNT_PATTERN = re.compile(r"^([\d,]+)")
NOISE_PATTERNS = ["Aldi Blvd", "Most Recent", "Database Updated", "See all BOLs"]


# ─── SCRAPE ───────────────────────────────────────────────────────────────────

def scrape_importyeti(company_name: str) -> tuple[str, str]:
    from playwright.sync_api import sync_playwright

    slug = re.sub(r"[',.]", "", company_name.lower().strip()).replace(" ", "-")
    url = f"https://www.importyeti.com/company/{slug}"
    console.log(f"[bold]Loading:[/bold] {url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_context(
            user_agent=HEADERS["User-Agent"],
            locale="en-US",
            viewport={"width": 1280, "height": 900},
        ).new_page()
        page.goto(url, wait_until="networkidle", timeout=30000)
        time.sleep(3)
        html = page.content()
        browser.close()

    console.log(f"Page loaded — {len(html):,} bytes")
    return html, url


# ─── GEMINI PARSING ───────────────────────────────────────────────────────────

def parse_with_gemini(html: str, company_name: str) -> dict:
    """Uses Gemini API to extract structured data from ImportYeti HTML."""
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key or not genai:
        if not api_key:
            console.log("[red]Error:[/red] GOOGLE_API_KEY environment variable not set.")
        if not genai:
            console.log("[red]Error:[/red] google-genai library not installed.")
        return {}

    client = genai.Client(api_key=api_key)
    soup = BeautifulSoup(html, "html.parser")
    
    # Extract only the main tables to stay within token limits / keep it clean
    tables = []
    for t in soup.find_all("table"):
        th_texts = [th.get_text(strip=True) for th in t.find_all("th")]
        if not th_texts: continue
        
        rows = []
        for tr in t.find_all("tr")[:30]: # Limit rows per table
            cells = [td.get_text(separator=" ", strip=True) for td in tr.find_all("td")]
            if cells: rows.append(" | ".join(cells))
        
        if rows:
            tables.append(f"Table (Headers: {', '.join(th_texts)}):\n" + "\n".join(rows))

    context_text = "\n\n".join(tables)
    
    prompt = f"""
    Analyze the ImportYeti supply chain data for '{company_name}'.
    Extract details about '{company_name}' itself AND its supplier relationships.
    
    IMPORTANT: If any field (like Company Description, HSN Code, or Shipment Route) is not explicitly 
    found in the provided data, use your internal general knowledge to fill them in. 
    DO NOT leave fields as "N/A" or "Unknown" if you can reasonably infer them.
    
    Return ONLY a valid JSON object with this exact structure:
    {{
      "top_products": ["List of top 5 specific products or HSN descriptions"],
      "focus_company": {{
        "name": "{company_name}",
        "country": "Country",
        "address": "Full Street Address, City, Country",
        "product_category": "Main Category",
        "description": "Short description of what the company does"
      }},
      "relationships": [
        {{
          "supplier_node": {{
            "name": "Supplier Company Name",
            "country": "Country",
            "address": "Full Street Address, City, Country",
            "product_category": "Main Category",
            "description": "Short description of what the supplier does"
          }},
          "edge": {{
            "product": "Specific Component Name",
            "product_description": "Detailed description of products shipped",
            "hsn_code": "HSN/HS Code",
            "shipment_route": "Logical shipment route"
          }}
        }}
      ]
    }}
    
    Data to parse:
    {context_text}
    """

    try:
        console.log(f"[bold]Gemini -> Parsing {company_name}...[/bold]")
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
            }
        )
        return json.loads(response.text)
    except Exception as e:
        console.log(f"[red]Gemini parsing failed:[/red] {e}")
        return {}


# ─── PARSE ───────────────────────────────────────────────────────────────────

def parse_page(html: str, url: str, company_name: str) -> dict:
    result = {
        "company": company_name,
        "url": url,
        "suppliers": [],
        "hts_codes": [],
        "country_breakdown": [],
    }

    soup = BeautifulSoup(html, "html.parser")

    # Strategy 1: __NEXT_DATA__ (cleanest — no parsing needed)
    script = soup.find("script", {"id": "__NEXT_DATA__"})
    if script:
        try:
            nd = json.loads(script.string)
            pp = nd.get("props", {}).get("pageProps", {})
            if _extract_next_data(pp, result):
                console.log("[green]Parsed via __NEXT_DATA__[/green]")
                return result
        except (json.JSONDecodeError, AttributeError):
            pass

    # Strategy 2: Gemini API Parsing
    console.log("[bold yellow]Falling back to Gemini API Parsing...[/bold yellow]")
    gemini_data = parse_with_gemini(html, company_name)
    if gemini_data:
        result.update({
            "suppliers": gemini_data.get("suppliers", []),
            "hts_codes": gemini_data.get("hts_codes", []),
            "country_breakdown": gemini_data.get("country_breakdown", []),
        })

        console.log(
            f"[green]Gemini Result:[/green] {len(result['suppliers'])} suppliers · "
            f"{len(result['hts_codes'])} HTS codes · "
            f"{len(result['country_breakdown'])} countries"
        )
        return result

    console.log("[red]All parsing strategies failed.[/red]")
    return result


def _extract_next_data(pp: dict, result: dict) -> bool:
    suppliers_raw = (
        pp.get("suppliers")
        or pp.get("company", {}).get("suppliers")
        or pp.get("data", {}).get("suppliers")
        or []
    )
    for s in suppliers_raw[:30]:
        if not isinstance(s, dict):
            continue
        result["suppliers"].append({
            "name": s.get("name", s.get("shipper_name", "Unknown")),
            "city": s.get("city", ""),
            "country": s.get("country", s.get("origin_country", "Unknown")),
            "shipments": str(s.get("shipment_count", s.get("count", "N/A"))),
            "product_categories": s.get("categories", s.get("products", [])),
        })

    hts_raw = (
        pp.get("hts_codes")
        or pp.get("company", {}).get("hts_codes")
        or pp.get("data", {}).get("hts_codes")
        or []
    )
    for h in hts_raw[:20]:
        if isinstance(h, dict):
            result["hts_codes"].append({
                "hs_code": h.get("code", h.get("hts", "")),
                "description": h.get("description", ""),
            })

    countries_raw = (
        pp.get("countries")
        or pp.get("company", {}).get("countries")
        or []
    )
    for c in countries_raw:
        if isinstance(c, dict):
            result["country_breakdown"].append({
                "country": c.get("country", c.get("name", "")),
                "shipments": str(c.get("shipment_count", c.get("count", "N/A"))),
            })

    return bool(result["suppliers"] or result["hts_codes"])


# ─── SEC EDGAR ────────────────────────────────────────────────────────────────

def fetch_sec_filing_content(cik: str, acc_no: str, primary_doc: str) -> str:
    """Fetches the actual text content of an SEC filing."""
    try:
        acc_no_clean = acc_no.replace("-", "")
        # SEC Archives URL format: https://www.sec.gov/Archives/edgar/data/CIK/ACC_NO/DOC
        url = f"https://www.sec.gov/Archives/edgar/data/{cik.lstrip('0')}/{acc_no_clean}/{primary_doc}"
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        # Cap at 50k chars to keep LLM context reasonable
        return resp.text[:50000]
    except Exception as e:
        console.log(f"[yellow]SEC filing fetch failed:[/yellow] {e}")
        return ""


def sec_edgar_lookup(cik: str) -> dict:
    try:
        cik = cik.zfill(10)
        resp = requests.get(
            f"https://data.sec.gov/submissions/CIK{cik}.json",
            headers=HEADERS, timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        recent = data.get("filings", {}).get("recent", {})
        
        filings = []
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        accessions = recent.get("accessionNumber", [])
        docs = recent.get("primaryDocument", [])
        
        for i in range(len(forms)):
            form = forms[i]
            # Prioritize financial records
            if form in ["10-K", "10-Q", "8-K", "20-F"]:
                filings.append({
                    "form": form,
                    "date": dates[i],
                    "accessionNumber": accessions[i],
                    "primaryDocument": docs[i]
                })
            if len(filings) >= 10:
                break
        
        addr = data.get("addresses", {}).get("mailing", {})
        full_addr = f"{addr.get('street1', '')}, {addr.get('city', '')}, {addr.get('stateOrCountry', '')}"
        
        return {
            "name": data.get("name"),
            "cik": cik,
            "sic_description": data.get("sicDescription"),
            "state_of_incorporation": data.get("stateOfIncorporation"),
            "address": full_addr.strip(", "),
            "tickers": data.get("tickers", []),
            "recent_filings": filings,
        }
    except Exception as e:
        console.log(f"[yellow]SEC EDGAR failed:[/yellow] {e}")
        return {}


# ─── DISPLAY ─────────────────────────────────────────────────────────────────

def display_suppliers(data: dict):
    console.rule(f"[bold cyan]Suppliers -> {data['company']}[/bold cyan]")
    if not data["suppliers"]:
        console.print("[yellow]No supplier data parsed.[/yellow]")
        console.print(f"[dim]Manual check: {data['url']}[/dim]")
        return

    t = Table(show_lines=True)
    t.add_column("#", style="dim", width=4)
    t.add_column("Supplier", style="bold cyan", min_width=28)
    t.add_column("City", min_width=12)
    t.add_column("Country", min_width=12)
    t.add_column("Shipments", justify="right", min_width=10)
    t.add_column("Product Categories", min_width=30)

    for i, s in enumerate(data["suppliers"], 1):
        cats = " · ".join(s.get("product_categories", [])[:3]) or "—"
        t.add_row(str(i), s["name"], s["city"], s["country"], s["shipments"], cats)

    console.print(t)


def display_hts(data: dict):
    if not data["hts_codes"]:
        return
    console.rule("[bold]Top HTS Codes Shipped[/bold]")
    t = Table(show_lines=True)
    t.add_column("HTS Code", style="bold", min_width=14)
    t.add_column("Product Description")
    for h in data["hts_codes"]:
        t.add_row(h["hs_code"], h["description"])
    console.print(t)


def display_countries(data: dict):
    if not data["country_breakdown"]:
        return
    console.rule("[bold]Shipments by Origin Country[/bold]")
    t = Table(show_lines=True)
    t.add_column("Country", style="bold", min_width=20)
    t.add_column("Shipments", justify="right")
    for c in sorted(
        data["country_breakdown"],
        key=lambda x: int(x["shipments"].replace(",", "") or 0),
        reverse=True,
    ):
        t.add_row(c["country"], c["shipments"])
    console.print(t)


def display_edgar(data: dict):
    if not data:
        return
    console.rule("[bold]SEC EDGAR[/bold]")
    console.print(f"  Name      : {data.get('name')}")
    console.print(f"  CIK       : {data.get('cik')}")
    console.print(f"  Industry  : {data.get('sic_description')}")
    console.print(f"  Tickers   : {', '.join(data.get('tickers', []))}")
    if data.get("recent_filings"):
        console.print("  Recent filings:")
        for f in data["recent_filings"]:
            console.print(f"    [{f['date']}] {f['form']}")


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def run(company: str, cik: str | None):
    html, url = scrape_importyeti(company)
    data = parse_page(html, url, company)

    display_suppliers(data)
    display_hts(data)
    display_countries(data)

    if cik:
        display_edgar(sec_edgar_lookup(cik))

    out_path = f"{company.lower().replace(' ', '_')}_supply_chain.json"
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)
    console.print(f"\n[green]Saved:[/green] {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Supply Chain X-Ray")
    parser.add_argument("--company", required=True, help="Target company, e.g. 'Apple'")
    parser.add_argument("--cik", default=None, help="SEC EDGAR CIK for financial data")
    args = parser.parse_args()
    run(company=args.company, cik=args.cik)