const fs = require('fs');
let html = fs.readFileSync('ui/index.html', 'utf8');
const startIdx = html.indexOf('function renderVariantGrid(categoryId, lineIdx) {');
const endIdx = html.indexOf('// ── Init ──');
const oldFunc = html.substring(startIdx, endIdx);

const newFunc = `function renderVariantGrid(categoryId, lineIdx) {
  const cv     = getCover(categoryId);
  const line   = (getLines(categoryId))[lineIdx] || getLines(categoryId)[0];
  const varDef = CAT_VARIANTS[categoryId] || CAT_VARIANTS.cat_01;
  const BRANDS    = varDef.brands;
  const TIERS     = varDef.tiers;
  const SIZES     = varDef.sizes;
  const BASE      = varDef.base + lineIdx * Math.round(varDef.base * 0.3);
  const DISCOUNTS = ['20% OFF on MRP','8% OFF on MRP','10% OFF','₹35 OFF'];

  let matchedIndexes = [];
  for (let k = 0; k < BRANDS.length; k++) {
    if (TIERS[k] === line.n) {
      matchedIndexes.push(k);
    }
  }
  if (matchedIndexes.length === 0) {
     const start = (lineIdx * 2) % BRANDS.length;
     matchedIndexes = [start, (start+1)%BRANDS.length, (start+2)%BRANDS.length];
  }

  document.getElementById('variant-grid').innerHTML = matchedIndexes.map((j, displayIdx)=>{
    const price   = Math.round(BASE * (1 + displayIdx * 0.8));
    const mrp     = Math.round(price * 1.22);
    const stars   = (3.8+displayIdx*0.2+lineIdx*0.05).toFixed(1);
    const reviews = (2000+displayIdx*3000+lineIdx*500).toLocaleString();
    
    // AIDA CDN photos for pet supplies; img[j] for everything else
    const imgUrl  = varDef.useAIDA
      ? (VARIANT_IMAGES[j % VARIANT_IMAGES.length] || '')
      : (varDef.img && varDef.img[j] ? varDef.img[j] : '');

    const imgHTML = imgUrl
      ? \`<img class="w-full h-full object-contain p-2" src="\${imgUrl}"
             onerror="this.style.display='none'" alt="\${BRANDS[j]}"/>\`
      : \`<div class="absolute inset-0 flex items-center justify-center">
           <span class="material-symbols-outlined text-[70px] opacity-30" style="color:\${cv.c};font-variation-settings:'FILL' 1;">\${line.ic||cv.ic}</span>
         </div>\`;

    return \`
      <div class="flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden relative">
        <div class="relative w-full aspect-square bg-white p-2" style="\${imgUrl?'':'background:'+cv.g}">
          \${imgHTML}
          <button class="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <span class="material-symbols-outlined text-[18px]">favorite</span>
          </button>
          <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            \${[0,1,2].map(k=>\`<span class="w-1 h-1 rounded-full \${k===0?'bg-on-surface':'bg-on-secondary-container/40'}"></span>\`).join('')}
          </div>
          <button class="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <span class="material-symbols-outlined text-[16px]">open_in_full</span>
          </button>
        </div>
        <div class="p-2.5 flex flex-col gap-1">
          <div class="flex items-center gap-1">
            <span class="material-symbols-outlined text-primary text-[14px]">schedule</span>
            <span class="text-[10px] font-bold text-on-surface">\${8+displayIdx*2} mins</span>
          </div>
          <h3 class="text-body-md font-bold leading-tight line-clamp-2 min-h-[40px]">\${BRANDS[j]}</h3>
          <div class="flex items-center gap-1 mt-0.5">
            <div class="bg-surface-container px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">\${SIZES[j]}</div>
            <div class="flex items-center text-[10px] font-bold">
              <span class="material-symbols-outlined text-yellow-500 text-[12px]" style="font-variation-settings:'FILL' 1;">star</span>
              <span class="ml-0.5">\${stars}</span>
              <span class="text-on-secondary-container font-normal ml-0.5">(\${reviews})</span>
            </div>
          </div>
          <div class="text-[11px] text-on-secondary-container font-medium mt-1">\${SIZES[j]}</div>
          <div class="flex items-center justify-between mt-1">
            <div class="flex flex-col">
              <div class="flex items-baseline gap-1">
                <span class="text-body-lg font-bold">₹\${price}</span>
                <span class="text-[10px] text-on-secondary-container line-through">₹\${mrp}</span>
              </div>
              <span class="text-[9px] font-bold text-blue-600">\${DISCOUNTS[displayIdx%DISCOUNTS.length]}</span>
            </div>
            <div class="flex flex-col items-center">
              <button class="add-btn border border-accent-green text-accent-green font-bold text-[11px] px-3 py-1.5 rounded-lg active:scale-95 transition-transform bg-white hover:bg-accent-green hover:text-white"
                data-category-id="\${categoryId}" data-price="₹\${price}" data-name="\${BRANDS[j]}" data-img="\${imgUrl}"
                onclick="handleAdd(this)">ADD</button>
              <span class="text-[8px] text-on-secondary-container mt-0.5 font-medium">\${displayIdx+1} option\${displayIdx>0?'s':''}</span>
            </div>
          </div>
        </div>
      </div>\`;
  }).join('');
}

`;

html = html.replace(oldFunc, newFunc);
fs.writeFileSync('ui/index.html', html);
console.log('Done!');
