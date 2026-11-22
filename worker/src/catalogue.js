// Seed data for first start. Edit prices/stock afterwards in /admin/ (the database is then the source of truth).
export default {
 "_comment": "Single source of truth for the catalogue SEED. Prices are integer paise and are DUMMY placeholders. initial_stock is a STARTING value only: set real stock in /admin/. After first start, the database (edited in /admin/) is the source of truth. Dabba packs are listed at the shop price for the same weight; the tier discount (settings.dabba_tiers) makes a Dabba cheaper than buying separately.",
 "settings": {
  "dabba_enabled": true,
  "min_packs": 3,
  "max_packs": 6,
  "low_stock_threshold": 5,
  "reservation_hours": 12,
  "dabba_tiers": [
   {
    "min_packs": 3,
    "percent": 10
   },
   {
    "min_packs": 6,
    "percent": 15
   }
  ]
 },
 "formats": [
  {
   "id": "trial",
   "label": "Trial",
   "label_hi": "ट्रायल",
   "sort": 1,
   "enabled": true
  },
  {
   "id": "regular",
   "label": "Regular",
   "label_hi": "रेगुलर",
   "sort": 2,
   "enabled": true
  },
  {
   "id": "family",
   "label": "Family",
   "label_hi": "फ़ैमिली",
   "sort": 3,
   "enabled": true
  }
 ],
 "products": [
  {
   "id": "swali",
   "name": "Signature Swali",
   "name_hi": "स्वाली / मठरी",
   "short_desc": "Crisp, flaky Marwari mathri from Mom's own recipe.",
   "short_desc_hi": "माँ की अपनी रेसिपी की कुरकुरी मारवाड़ी मठरी।",
   "image": "/images/swali-main.webp",
   "sort": 1,
   "enabled": true,
   "variants": [
    {
     "sku": "SWALI-T",
     "kind": "dabba",
     "format": "trial",
     "type": null,
     "size": null,
     "label": "Trial 150g",
     "weight_g": 150,
     "price_paise": 7200,
     "enabled": true
    },
    {
     "sku": "SWALI-R",
     "kind": "dabba",
     "format": "regular",
     "type": null,
     "size": null,
     "label": "Regular 250g",
     "weight_g": 250,
     "price_paise": 12000,
     "enabled": true
    },
    {
     "sku": "SWALI-F",
     "kind": "dabba",
     "format": "family",
     "type": null,
     "size": null,
     "label": "Family 500g",
     "weight_g": 500,
     "price_paise": 22000,
     "enabled": true
    },
    {
     "sku": "SWALI-OIL-250",
     "kind": "single",
     "format": null,
     "type": "Fresh Oil",
     "size": "250gms",
     "label": "Fresh Oil · 250gms",
     "weight_g": 250,
     "price_paise": 12000,
     "enabled": true
    },
    {
     "sku": "SWALI-OIL-500",
     "kind": "single",
     "format": null,
     "type": "Fresh Oil",
     "size": "500gms",
     "label": "Fresh Oil · 500gms",
     "weight_g": 500,
     "price_paise": 22000,
     "enabled": true
    },
    {
     "sku": "SWALI-OIL-1KG",
     "kind": "single",
     "format": null,
     "type": "Fresh Oil",
     "size": "1kg",
     "label": "Fresh Oil · 1kg",
     "weight_g": 1000,
     "price_paise": 40000,
     "enabled": true
    },
    {
     "sku": "SWALI-GHEE-250",
     "kind": "single",
     "format": null,
     "type": "Pure Desi Ghee",
     "size": "250gms",
     "label": "Pure Desi Ghee · 250gms",
     "weight_g": 250,
     "price_paise": 15000,
     "enabled": true
    },
    {
     "sku": "SWALI-GHEE-500",
     "kind": "single",
     "format": null,
     "type": "Pure Desi Ghee",
     "size": "500gms",
     "label": "Pure Desi Ghee · 500gms",
     "weight_g": 500,
     "price_paise": 28000,
     "enabled": true
    },
    {
     "sku": "SWALI-GHEE-1KG",
     "kind": "single",
     "format": null,
     "type": "Pure Desi Ghee",
     "size": "1kg",
     "label": "Pure Desi Ghee · 1kg",
     "weight_g": 1000,
     "price_paise": 52000,
     "enabled": true
    },
    {
     "sku": "SWALI-AIR-250",
     "kind": "single",
     "format": null,
     "type": "Air-Fried",
     "size": "250gms",
     "label": "Air-Fried · 250gms",
     "weight_g": 250,
     "price_paise": 12000,
     "enabled": true
    },
    {
     "sku": "SWALI-AIR-500",
     "kind": "single",
     "format": null,
     "type": "Air-Fried",
     "size": "500gms",
     "label": "Air-Fried · 500gms",
     "weight_g": 500,
     "price_paise": 22000,
     "enabled": true
    },
    {
     "sku": "SWALI-AIR-1KG",
     "kind": "single",
     "format": null,
     "type": "Air-Fried",
     "size": "1kg",
     "label": "Air-Fried · 1kg",
     "weight_g": 1000,
     "price_paise": 40000,
     "enabled": true
    }
   ]
  },
  {
   "id": "chakli",
   "name": "Signature Chakli",
   "name_hi": "चकली",
   "short_desc": "Crunchy, golden chakli, made fresh at home.",
   "short_desc_hi": "कुरकुरी, सुनहरी चकली, घर पर ताज़ा बनी।",
   "image": "/images/chakli-main.webp",
   "sort": 2,
   "enabled": true,
   "variants": [
    {
     "sku": "CHAKLI-T",
     "kind": "dabba",
     "format": "trial",
     "type": null,
     "size": null,
     "label": "Trial 100g",
     "weight_g": 100,
     "price_paise": 4800,
     "enabled": true
    },
    {
     "sku": "CHAKLI-R",
     "kind": "dabba",
     "format": "regular",
     "type": null,
     "size": null,
     "label": "Regular 200g",
     "weight_g": 200,
     "price_paise": 9600,
     "enabled": true
    },
    {
     "sku": "CHAKLI-F",
     "kind": "dabba",
     "format": "family",
     "type": null,
     "size": null,
     "label": "Family 400g",
     "weight_g": 400,
     "price_paise": 17600,
     "enabled": true
    },
    {
     "sku": "CHAKLI-250",
     "kind": "single",
     "format": null,
     "type": null,
     "size": "250gms",
     "label": "250gms",
     "weight_g": 250,
     "price_paise": 12000,
     "enabled": true
    },
    {
     "sku": "CHAKLI-500",
     "kind": "single",
     "format": null,
     "type": null,
     "size": "500gms",
     "label": "500gms",
     "weight_g": 500,
     "price_paise": 22000,
     "enabled": true
    },
    {
     "sku": "CHAKLI-1KG",
     "kind": "single",
     "format": null,
     "type": null,
     "size": "1kg",
     "label": "1kg",
     "weight_g": 1000,
     "price_paise": 40000,
     "enabled": true
    }
   ]
  },
  {
   "id": "chivda",
   "name": "Signature Chiwda",
   "name_hi": "भुना पोहा चिवड़ा",
   "short_desc": "Light, crunchy and tangy roasted poha chiwda, made fresh at home.",
   "short_desc_hi": "हल्का, कुरकुरा और चटपटा भुना पोहा चिवड़ा, घर पर ताज़ा बना।",
   "image": "/images/chivda-main.webp",
   "sort": 3,
   "enabled": true,
   "variants": [
    {
     "sku": "CHIWDA-T",
     "kind": "dabba",
     "format": "trial",
     "type": null,
     "size": null,
     "label": "Trial 150g",
     "weight_g": 150,
     "price_paise": 7200,
     "enabled": true
    },
    {
     "sku": "CHIWDA-R",
     "kind": "dabba",
     "format": "regular",
     "type": null,
     "size": null,
     "label": "Regular 250g",
     "weight_g": 250,
     "price_paise": 12000,
     "enabled": true
    },
    {
     "sku": "CHIWDA-F",
     "kind": "dabba",
     "format": "family",
     "type": null,
     "size": null,
     "label": "Family 500g",
     "weight_g": 500,
     "price_paise": 22000,
     "enabled": true
    },
    {
     "sku": "CHIWDA-250",
     "kind": "single",
     "format": null,
     "type": null,
     "size": "250gms",
     "label": "250gms",
     "weight_g": 250,
     "price_paise": 12000,
     "enabled": true
    },
    {
     "sku": "CHIWDA-500",
     "kind": "single",
     "format": null,
     "type": null,
     "size": "500gms",
     "label": "500gms",
     "weight_g": 500,
     "price_paise": 22000,
     "enabled": true
    },
    {
     "sku": "CHIWDA-1KG",
     "kind": "single",
     "format": null,
     "type": null,
     "size": "1kg",
     "label": "1kg",
     "weight_g": 1000,
     "price_paise": 40000,
     "enabled": true
    }
   ]
  }
 ],
 "initial_stock": {
  "SWALI-T": 25,
  "SWALI-R": 25,
  "SWALI-F": 25,
  "SWALI-OIL-250": 25,
  "SWALI-OIL-500": 25,
  "SWALI-OIL-1KG": 25,
  "SWALI-GHEE-250": 25,
  "SWALI-GHEE-500": 25,
  "SWALI-GHEE-1KG": 25,
  "SWALI-AIR-250": 25,
  "SWALI-AIR-500": 25,
  "SWALI-AIR-1KG": 25,
  "CHAKLI-T": 25,
  "CHAKLI-R": 15,
  "CHAKLI-F": 25,
  "CHAKLI-250": 25,
  "CHAKLI-500": 25,
  "CHAKLI-1KG": 25,
  "CHIWDA-T": 25,
  "CHIWDA-R": 20,
  "CHIWDA-F": 25,
  "CHIWDA-250": 25,
  "CHIWDA-500": 25,
  "CHIWDA-1KG": 25
 }
};
