const fs = require('fs');
const file = 'src/pages/SeedBPMTemplates.jsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/supervisa:\s*".*?"/g, 'supervisa: "Proceso - Productivo"');
fs.writeFileSync(file, content);
console.log('Done replacing supervisa!');
