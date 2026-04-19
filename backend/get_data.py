import json
import argparse
import time
import logging
if __package__:
    from .retriver import parse_with_gemini, scrape_importyeti
else:
    from retriver import parse_with_gemini, scrape_importyeti

# Set up logging for CLI execution
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

class GlobalGraph:
    def __init__(self):
        self.top_products = []
        self.nodes = {}  # {name: {node_data}}
        self.edges = []  # [{edge_data}]

    def add_node(self, name, tier, country=None, category=None, description=None):
        if name not in self.nodes:
            self.nodes[name] = {
                "Company Name": name,
                "Country": country or "Unknown",
                "Product Category": category or "N/A",
                "Company Description": description or f"A supplier involved in the supply chain of relevant industries.",
                "Tier": tier
            }
        else:
            if country and self.nodes[name]["Country"] == "Unknown":
                self.nodes[name]["Country"] = country
            if category and self.nodes[name]["Product Category"] == "N/A":
                self.nodes[name]["Product Category"] = category

    def add_edge(self, source, target, product, description, hsn, route):
        self.edges.append({
            "Company1": source,
            "Company2": target,
            "Product": product,
            "Product Description": description,
            "HSN Code of Products": hsn,
            "Possible Shipment Route": route
        })

    def to_json(self):
        return {
            "top_products": self.top_products,
            "nodes": list(self.nodes.values()),
            "edges": self.edges
        }

def explore_node(graph, parent_name: str, current_depth: int, max_depth: int, breadth_limit: int):
    """Recursively explores the supply chain and populates the global graph."""
    if current_depth >= max_depth:
        return

    logger.info(f"--- Level {current_depth} Analysis: {parent_name} ---")
    
    try:
        html, url = scrape_importyeti(parent_name)
        gemini_data = parse_with_gemini(html, parent_name)
    except Exception as e:
        logger.warning(f"Scrape failed for {parent_name}: {e}")
        logger.info(f"Attempting Gemini internal knowledge fallback for {parent_name}...")
        gemini_data = parse_with_gemini("", parent_name)

    # Capture top products only for the root focus company
    if current_depth == 0:
        graph.top_products = gemini_data.get("top_products", [])

    # Add/Update the root node (target company) at Tier 0
    f_company = gemini_data.get("focus_company", {})
    graph.add_node(
        name=parent_name,
        tier=current_depth, # Which is 0
        country=f_company.get("country"),
        category=f_company.get("product_category"),
        description=f_company.get("description")
    )

    relationships = gemini_data.get("relationships", [])
    if not relationships:
        logger.warning(f"No relationships found for {parent_name}")
        return

    targets = relationships[:breadth_limit]
    
    for i, rel in enumerate(targets, 1):
        s_node = rel.get("supplier_node", {})
        s_edge = rel.get("edge", {})
        
        supplier_name = s_node.get("name")
        if not supplier_name: continue

        graph.add_node(
            name=supplier_name,
            tier=current_depth + 1,
            country=s_node.get("country"),
            category=s_node.get("product_category"),
            description=s_node.get("description")
        )

        graph.add_edge(
            source=parent_name,
            target=supplier_name,
            product=s_edge.get("product", "Various"),
            description=s_edge.get("product_description", "N/A"),
            hsn=s_edge.get("hsn_code", "N/A"),
            route=s_edge.get("shipment_route", "N/A")
        )

        logger.info(f"L{current_depth}->L{current_depth+1} ({i}/{len(targets)}): {supplier_name}")
        explore_node(graph, supplier_name, current_depth + 1, max_depth, breadth_limit)

def get_supply_chain_data(company_name: str, depth: int = 2, limit: int = 3):
    """Entry point for building the supply chain graph as a dictionary."""
    graph = GlobalGraph()
    explore_node(graph, company_name, 0, depth, limit)
    return graph.to_json()

def main():
    parser = argparse.ArgumentParser(description="Recursive Supply Chain Graph Builder")
    parser.add_argument("--company", required=True, help="Target company, e.g. 'Apple'")
    parser.add_argument("--depth", type=int, default=2, help="Recursion depth (default: 2)")
    parser.add_argument("--limit", type=int, default=3, help="Max suppliers to follow per level (default: 3)")
    args = parser.parse_args()

    logger.info(f"Building Recursive Graph for {args.company} (Depth: {args.depth}, Limit: {args.limit})")
    
    graph = GlobalGraph()
    
    start_time = time.time()
    explore_node(graph, args.company, 0, args.depth, args.limit)
    
    duration = time.time() - start_time
    logger.info(f"Graph construction complete in {duration:.1f}s")

    out_path = f"{args.company.lower().replace(' ', '_')}_supply_chain_graph.json"
    with open(out_path, "w") as f:
        json.dump(graph.to_json(), f, indent=2)
    
    logger.info(f"Graph saved to: {out_path}")

if __name__ == "__main__":
    main()
