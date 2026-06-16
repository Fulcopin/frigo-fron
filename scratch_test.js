const expr = "[Peso Caja (Tapa / fondo)] + [Peso Plástico]";
const keys = ["Peso Caja (Tapa / fondo)", "Peso Plástico"];
let replaced = expr;
keys.forEach(k => {
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');
  replaced = replaced.replace(regex, '1');
});
console.log(replaced);
