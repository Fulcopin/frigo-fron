import pyodbc, os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
from config import get_connection_string

conn = pyodbc.connect(get_connection_string())
cur = conn.cursor()

# Extraer todos los lotes no vacíos de FilledForms
cur.execute("SELECT FormID, TemplateID, CreatedAt, HeaderData, BodyData FROM FilledForms ORDER BY CreatedAt DESC")
rows = cur.fetchall()

lotes_encontrados = []

for form_id, template_id, created_at, header_raw, body_raw in rows:
    # Buscar lote en HeaderData
    try:
        header = json.loads(header_raw or "{}")
        for k, v in header.items():
            if "lote" in k.lower() and v:
                lotes_encontrados.append({
                    "FormID": form_id,
                    "Fecha": str(created_at)[:10],
                    "Fuente": f"Header[{k}]",
                    "Lote": v,
                })
    except Exception:
        pass

    # Buscar lote en BodyData (tablas anidadas)
    try:
        body = json.loads(body_raw or "[]")
        for elemento in body:
            if elemento.get("type") == "table":
                for fila in elemento.get("data", []):
                    for k, v in fila.items():
                        if "lote" in k.lower() and v:
                            lotes_encontrados.append({
                                "FormID": form_id,
                                "Fecha": str(created_at)[:10],
                                "Fuente": f"Body[{k}]",
                                "Lote": v,
                            })
    except Exception:
        pass

# Deduplicar por valor de lote
vistos = set()
unicos = []
for l in lotes_encontrados:
    key = l["Lote"]
    if key not in vistos:
        vistos.add(key)
        unicos.append(l)

# También ver SourceForms si tiene filas
cur.execute("SELECT COUNT(*) FROM SourceForms")
n = cur.fetchone()[0]
print(f"SourceForms: {n} filas")

conn.close()

print(f"\nTotal lotes únicos encontrados: {len(unicos)}")
print(f"{'FormID':>6}  {'Fecha':>10}  {'Campo':<25}  Lote")
print("-" * 70)
for l in sorted(unicos, key=lambda x: x["Fecha"], reverse=True):
    print(f"{l['FormID']:>6}  {l['Fecha']:>10}  {l['Fuente']:<25}  {l['Lote']}")


conn = pyodbc.connect(cs)
cur = conn.cursor()

# 1) Ver todas las tablas
cur.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
tablas = [r[0] for r in cur.fetchall()]
print("TABLAS:", tablas)

# 2) Buscar tablas que contengan "lote" en el nombre
lote_tablas = [t for t in tablas if "lote" in t.lower()]
print("TABLAS CON 'lote':", lote_tablas)

# 3) Si hay alguna, mostrar los datos
for tabla in lote_tablas:
    print(f"\n=== {tabla} ===")
    try:
        cur.execute(f"SELECT TOP 50 * FROM [{tabla}]")
        cols = [d[0] for d in cur.description]
        print("Columnas:", cols)
        for row in cur.fetchall():
            print(dict(zip(cols, row)))
    except Exception as e:
        print("Error:", e)

conn.close()
