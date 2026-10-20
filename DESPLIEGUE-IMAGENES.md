# 📸 Imágenes desde el servidor local (fotos y firmas sin Cloudinary)

**Problema que resuelve.** La red de la planta tiene bloqueado `res.cloudinary.com`,
así que el navegador de las PC de producción no puede bajar las fotos ni las firmas
y la página sale "bloqueada". El servidor de la planta **sí** tiene salida a internet.

**La solución.** El navegador le pide la imagen al servidor de la planta
(`/api/Images/proxy`), el servidor la baja una vez de Cloudinary, la guarda en su
disco y la devuelve. Las siguientes veces ya sale del disco. Cloudinary sigue siendo
el respaldo: **no se borra nada de la nube**.

---

## Qué hay que copiar (2 paquetes)

| Paquete | A dónde va |
|---|---|
| `actualizacion-backend-imagenes.zip` | Se descomprime en `C:\inetpub\wwwroot\DeployFormularios` (backend) |
| `actualizacion-frontend.zip` | Se descomprime en la carpeta del sitio del frontend (el que abre en el puerto 80) |

> ⚠️ **No reemplaces `appsettings.json`** en la carpeta del backend. El zip trae
> únicamente `FormBuilder.API.dll` y `FormBuilder.API.pdb`, así que no lo toca.
>
> ⚠️ En el frontend **descomprime encima** de lo que ya está: la carpeta tiene un
> `web.config` que NO viene en el zip y que hay que conservar.

---

## Paso 1 — Backend

1. Detén el sitio para poder reemplazar la DLL, o simplemente reemplázala
   (si Windows dice que el archivo está en uso, recicla antes el App Pool).
2. Copia `FormBuilder.API.dll` y `FormBuilder.API.pdb` a
   `C:\inetpub\wwwroot\DeployFormularios\`.
3. **Recicla el App Pool** del sitio:
   *IIS Manager → Application Pools → (el del sitio) → Recycle*.
   Desde consola (como administrador): `%windir%\system32\inetsrv\appcmd recycle apppool /apppool.name:"DefaultAppPool"`
   (usa el nombre real del App Pool).

### Comprobar que quedó bien

Abre en el navegador (desde cualquier PC de la planta):

```
http://192.168.0.88:8096/api/Images/diagnostico
```

Debe decir `"version":"2"` y `"puedeEscribir": true`.

```json
{ "puedeBajarDeCloudinary": true, "puedeEscribir": true,
  "carpeta": "C:\\...\\imagenes-cache", "archivos": 0, "version": "2" }
```

* **`puedeBajarDeCloudinary: false`** → el servidor no tiene internet. Revisar el firewall del servidor.
* **`puedeEscribir: false`** → no hay carpeta escribible: **las imágenes igual se ven**
  (se bajan al momento y se devuelven sin guardar copia), solo que no quedan cacheadas.
  El mismo JSON trae la lista `candidatas` con el error de cada carpeta.

### Prueba de fuego (una imagen real)

```
http://192.168.0.88:8096/api/Images/proxy?u=https%3A%2F%2Fres.cloudinary.com%2Fdpczd4ufe%2Fimage%2Fupload%2Fsample.jpg
```

Si el navegador muestra la imagen, el servidor está sirviendo las fotos.

---

## Paso 2 — Frontend

1. Descomprime `actualizacion-frontend.zip` en la carpeta del sitio (la del puerto 80).
2. En las PC de la planta: **Ctrl + F5** (una vez) para que el navegador no use el
   archivo viejo de su caché.

Con eso, al abrir el formulario las fotos y firmas se piden al servidor de la planta
en vez de a Cloudinary.

---

## (Opcional) Traer de una todas las imágenes que ya existen

Para que las fotos viejas no dependan ni de la primera visita ni del internet del
servidor, se pueden bajar todas de una vez (desde una PC con acceso al servidor):

```
npm run traer-imagenes -- http://192.168.0.88:8096/api
```

Es idempotente: si una imagen ya está guardada, no la vuelve a bajar.
Al terminar, `diagnostico` debe mostrar `archivos` con el total guardado.

---

## Si NO se puede copiar la DLL (alternativa rápida)

La versión que ya está en el servidor funciona igual **si le das permiso de
escritura a su carpeta**. En el servidor, como administrador:

```
mkdir "C:\inetpub\wwwroot\DeployFormularios\imagenes-cache"
icacls "C:\inetpub\wwwroot\DeployFormularios\imagenes-cache" /grant "IIS_IUSRS:(OI)(CI)M"
```

(Si el App Pool corre con otra cuenta, usar esa cuenta en lugar de `IIS_IUSRS`.)

Sirve igual, pero **el frontend se tiene que copiar de todas formas**: es el que sabe
pedirle las imágenes al servidor en lugar de a Cloudinary.

---

## Ojo: qué más viene en este paquete

El frontend que está publicado en planta es **viejo**: no tiene ninguno de los
cambios de estas semanas. Al copiar `actualizacion-frontend.zip` entran, además de las
imágenes:

* Los totales de **Personal** (`/personal-indicadores`) y la casilla
  "📊 Mostrar total en Personal" del editor de plantillas.
* **Clic en una foto/firma = descargarla** (antes el clic no bajaba nada).
* El **PD-15** no deja guardar sin "PESO PROCESO".
* El Excel agrupado ahora **repite el lote y la talla** en cada fila hija.

El paquete se compiló con las direcciones de planta (`http://192.168.0.88:...`), igual
que el que está publicado, **y además** deja el servicio de IA en
`http://192.168.0.88:8099/api/ai` (el que sí está corriendo en el servidor). El build
publicado apuntaba a `localhost:8100`, que no existe en ninguna PC, así que FrigoVoice
no podía funcionar; con este paquete queda apuntando al servidor de planta.

Si en planta usaran otra IP para el API, hay que recompilar:

```powershell
$env:VITE_API_BASE_URL='http://LA-IP:8096/api'
$env:VITE_API_EXTERNAL_URL='http://LA-IP:8098/api'
$env:VITE_AI_API_URL='http://LA-IP:8099/api/ai'
npm run build
```

---

## Reversión

* Backend: guarda una copia del `FormBuilder.API.dll` anterior antes de reemplazarlo.
* Frontend: guarda una copia de la carpeta actual (o al menos de `index.html` y `assets/`).
