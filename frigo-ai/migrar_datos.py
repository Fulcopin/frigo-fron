import re
import os

# Esta línea detecta automáticamente la carpeta donde está este script
base_path = os.path.dirname(os.path.abspath(__file__))

# Buscamos CUALQUIER archivo que termine en .sql en esa carpeta
archivos_sql = [f for f in os.listdir(base_path) if f.endswith('.sql')]

if not archivos_sql:
    print(f"❌ Error: No encontré ningún archivo .sql en la carpeta: {base_path}")
else:
    # Usamos el primer archivo .sql que encuentre (el tuyo de formularios)
    nombre_archivo = archivos_sql[0]
    ruta_completa = os.path.join(base_path, nombre_archivo)
    
    print(f"✅ Procesando archivo: {nombre_archivo}...")

    # Cambiamos encoding='utf-8' por 'utf-16' para que pueda leer el archivo de SQL Server
    with open(ruta_completa, 'r', encoding='utf-16') as f:
        sql = f.read()

    lineas_procesadas = []

    for linea in sql.split('\n'):
        if linea.startswith('INSERT '):
            linea = re.sub(r'INSERT\s+\[dbo\]\.\[(.*?)\]', r'INSERT INTO "\1"', linea)
            if 'VALUES' in linea:
                partes = linea.split('VALUES')
                partes[0] = re.sub(r'\[(.*?)\]', r'"\1"', partes[0])
                linea = 'VALUES'.join(partes)
            linea = linea.replace(" N'", " '").replace("(N'", "('")
            linea = linea.replace("AS DateTime2)", "AS TIMESTAMP)")
            lineas_procesadas.append(linea)

    with open(os.path.join(base_path, 'datos_postgres_limpios.sql'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lineas_procesadas))

    print(f"🚀 ¡ÉXITO! Se ha creado 'datos_postgres_limpios.sql' con {len(lineas_procesadas)} registros.")