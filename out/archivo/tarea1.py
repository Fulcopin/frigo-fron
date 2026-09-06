import random as rd

def obtener_sector_aleatorio(cadena_completa):
    sectores = cadena_completa.strip().split('#')
    sector_elegido = rd.choice(sectores)
    nombre_sector = sector_elegido.split('[')[0]
    horarios = sector_elegido.split('[')[1].replace(']', '')
    return nombre_sector.upper(), horarios

def contar_cortes(horarios_sector):
    cortes = horarios_sector.split(',')
    return len(cortes)

def obtener_jornada(horario):
   
    if ('-' in horario) and (':' in horario):
        hora_fin_str = horario.split('-')[1]
        hora_str = hora_fin_str.split(':')[0]
        
        # Comprobamos si la hora es un número
        if hora_str.isdigit() == True:
            hora_fin = int(hora_str)

            if 6 <= hora_fin <= 12:
                return "mañana"
            elif 12 < hora_fin <= 18:
                return "tarde"
            elif 18 < hora_fin <= 23:
                return "noche"
            else:
                return "madrugada"
        else:
            return "desconocido"
    else:
        return "desconocido"

def es_madrugada(horario):
    if obtener_jornada(horario) == "madrugada":
        return True
    else:
        return False

def ejecutar_parte1():
    print("--- INICIO PARTE 1 ---")
    cadena_input = input("Ingrese la cadena con sectores y horarios:\n")
    
    sectores = cadena_input.strip().split('#')
    
    if len(sectores) < 2:
        print("Error: La cadena debe contener al menos 2 sectores.")
    else:
        penultimo_sector_str = sectores[-2]
    
        nombre_sector = penultimo_sector_str.split('[')[0].upper()
        horarios_str = penultimo_sector_str.split('[')[1].replace(']', '')
        lista_horarios = horarios_str.split(',')
        
        total_cortes = contar_cortes(horarios_str)
        
        if len(lista_horarios) < 2:
            print(f"Error: El sector '{nombre_sector}' no tiene un penúltimo horario.")
        else:
            penultimo_horario = lista_horarios[-2]
            hora_inicio = penultimo_horario.split('-')[0]
            hora_fin = penultimo_horario.split('-')[1]
            
            es_de_madrugada = es_madrugada(penultimo_horario)
            
            print("\n--------------- CORTES DE LUZ ----------")
            print(f" Sector:{nombre_sector}")
            print(f" Total de cortes:{total_cortes}")
            print(f" Penúltimo horario: {hora_inicio}| {hora_fin}")
            print(f" Es en la madrugada: {str(es_de_madrugada):^15}")
            print("----------------------------------------")
            print("---------30-----------|---15---|---15--|\n")

def calcular_duracion(horario):
    resultado = "0000000"
    if '-' in horario:
        partes = horario.split('-')
        inicio_str = partes[0]
        fin_str = partes[1]

        hora_inicio_str = inicio_str.split(':')[0]
        hora_fin_str = fin_str.split(':')[0]
        
        if hora_inicio_str.isdigit() == True and hora_fin_str.isdigit() == True:
            hora_inicio = int(hora_inicio_str)
            hora_fin = int(hora_fin_str)
            duracion = hora_fin - hora_inicio
            resultado = str(duracion).zfill(7)
            
    return resultado

def obtener_listas_paralelas(cadena_completa):
    entradas = cadena_completa.strip().split('#')
    lista_horarios = []
    lista_sectores_str = []
    
    for entrada in entradas:
        partes = entrada.split('[')
        if len(partes) == 2:
            lista_horarios.append(partes[0])
            lista_sectores_str.append(partes[1].replace(']', ''))
            
    return lista_horarios, lista_sectores_str

def ejecutar_parte2():
    print("--- INICIO PARTE 2 ---")
    cadena_fija = "10:00-14:00[sector1 sector2]#16:00-19:00[sector3 sector1 sector4]#2:00-4:00[sector4 sector2 sector3]"
    
    horarios, sectores_agrupados = obtener_listas_paralelas(cadena_fija)
    
    if len(horarios) == 0:
        print("La cadena está vacía o tiene un formato incorrecto.")
    else:
        indice_aleatorio = rd.randint(0, len(horarios) - 1)
        
        horario_elegido = horarios[indice_aleatorio]
        sectores_elegidos_str = sectores_agrupados[indice_aleatorio]
        
        hora_inicio = horario_elegido.split('-')[0]
        hora_fin = horario_elegido.split('-')[1]
        
        duracion_formateada = calcular_duracion(horario_elegido)
        
        lista_sectores = sectores_elegidos_str.split()
        
       
        lista_de_iniciales = []
        for sector in lista_sectores:
            primera_letra_mayuscula = sector[0].upper()
            lista_de_iniciales.append(primera_letra_mayuscula)
        iniciales = ",".join(lista_de_iniciales)
        
        es_de_madrugada = es_madrugada(horario_elegido)
        
        print("\n--------------- CORTES DE LUZ ----------")
        print(f" Horario: {hora_inicio}| {hora_fin}")
        print(f" Duración:{duracion_formateada}")
        print(f" Sectores:{iniciales}")
        print(f" Es en la madrugada: {str(es_de_madrugada):^15}")
        print("----------------------------------------")
        print("---------30-----------|---15---|---15--|")

if __name__ == "__main__":
    print("### TAREA 4 - EL APAGÓN ###\n")
    ejecutar_parte1()
    ejecutar_parte2()