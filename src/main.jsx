import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import "./styles/responsive.css"
import { detectarSoporteImagenes, instalarRespaldoImagenes } from "./utils/urlImagen"

// 🖼️ Fotos y firmas: se sirven desde el servidor local (misma IP) teniendo
// Cloudinary como respaldo. Se detecta una vez si el servidor ya lo soporta y
// se deja instalado el respaldo automático para cualquier imagen.
instalarRespaldoImagenes()
detectarSoporteImagenes()

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
