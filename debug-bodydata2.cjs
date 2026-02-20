const http = require('http');

http.get('http://localhost:5074/api/FilledForms', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const forms = json['$values'] || json;
    console.log('=== TOTAL FORMS:', forms.length, '===\n');
    
    // Simular la lógica de ExtractConsumptions para CADA form
    let totalExtracted = 0;
    
    const productKeys = ["producto", "insumo", "material", "item", "descripcion", "nombre", "materia prima", "suministro", "ingrediente", "subproducto"];
    const quantityKeys = ["cantidad", "peso", "kg", "litros", "unidades", "total", "volumen", "consumo", "kilos", "gramos"];
    
    forms.forEach((f, fi) => {
      let bd;
      try { bd = JSON.parse(f.bodyData || '[]'); } catch(e) { return; }
      if (!Array.isArray(bd)) return;
      
      const extracted = [];
      
      bd.forEach((table, ti) => {
        if (!table.data || !Array.isArray(table.data)) return;
        
        table.data.forEach((row, ri) => {
          let productName = null;
          let quantity = 0;
          
          // Buscar producto
          for (const [key, val] of Object.entries(row)) {
            const keyLower = key.toLowerCase().trim();
            for (const pk of productKeys) {
              if (keyLower.includes(pk) && typeof val === 'string' && val.trim() !== '') {
                productName = val;
                break;
              }
            }
            if (productName) break;
          }
          
          // Buscar cantidad
          for (const [key, val] of Object.entries(row)) {
            const keyLower = key.toLowerCase().trim();
            for (const qk of quantityKeys) {
              if (keyLower.includes(qk)) {
                const n = parseFloat(val);
                if (!isNaN(n) && n > 0) {
                  quantity = n;
                  break;
                }
              }
            }
            if (quantity > 0) break;
          }
          
          if (productName && quantity > 0) {
            extracted.push({ table: ti, row: ri, productName, quantity });
          }
        });
      });
      
      if (extracted.length > 0) {
        totalExtracted += extracted.length;
        console.log(`FORM ${f.formID} (template ${f.templateID}) - ${extracted.length} items:`);
        extracted.forEach(e => {
          console.log(`  T[${e.table}] R[${e.row}]: "${e.productName}" = ${e.quantity}`);
        });
      }
    });
    
    console.log(`\n=== TOTAL ITEMS EXTRACTED: ${totalExtracted} ===`);
    
    // Ahora mostrar TODAS las columnas de TODOS los formularios para entender qué hay
    console.log('\n=== COLUMN NAMES ACROSS ALL FORMS ===');
    const allColumns = new Map();
    forms.forEach(f => {
      let bd;
      try { bd = JSON.parse(f.bodyData || '[]'); } catch(e) { return; }
      if (!Array.isArray(bd)) return;
      bd.forEach((table, ti) => {
        if (!table.data || !Array.isArray(table.data) || table.data.length === 0) return;
        const cols = Object.keys(table.data[0]);
        const key = cols.join(' | ');
        if (!allColumns.has(key)) {
          allColumns.set(key, { count: 0, templateIDs: new Set() });
        }
        allColumns.get(key).count++;
        allColumns.get(key).templateIDs.add(f.templateID);
      });
    });
    
    console.log('Unique column sets:');
    for (const [cols, info] of allColumns) {
      console.log(`  [Templates: ${[...info.templateIDs].join(',')}] (${info.count}x): ${cols}`);
    }
  });
}).on('error', e => console.error('ERROR:', e.message));
