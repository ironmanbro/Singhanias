/* Allergy information: single source for the home page and the Dabba page. [English, Hindi] per item.
   EDIT to match your real products. Cross-contact can't be ruled out in a home kitchen, so the note is always shown. */
window.ALLERGENS = {
  swali:  [['Wheat (gluten)', 'गेहूँ (ग्लूटेन)'], ['Milk (ghee version only)', 'दूध (सिर्फ़ घी वाले में)']],
  chakli: [['Sesame', 'तिल'], ['Milk', 'दूध']],
  chivda: [['Peanuts', 'मूँगफली'], ['Chickpea (chana)', 'चना']]
};
window.ALLERGEN_NOTE = ['Made in a home kitchen, so traces of other allergens cannot be ruled out. If you have a serious allergy, please message us on WhatsApp before ordering.', 'यह घर की रसोई में बनता है, इसलिए दूसरे एलर्जी-कारकों के अंश होने से इनकार नहीं किया जा सकता। गंभीर एलर्जी हो तो ऑर्डर से पहले WhatsApp पर हमें बताइए।'];

/* Allergen checker data (home page): which allergens each snack contains. gheeOnly = only in the ghee version. */
window.ALLERGEN_CHECK = {
  items: [['gluten', 'Gluten', 'ग्लूटेन'], ['milk', 'Milk', 'दूध'], ['sesame', 'Sesame', 'तिल'], ['peanuts', 'Peanuts', 'मूँगफली'], ['chickpea', 'Chickpea', 'चना']],
  has: { swali: ['gluten', 'milk'], chakli: ['sesame', 'milk'], chivda: ['peanuts', 'chickpea'] },
  gheeOnly: { swali: ['milk'] }
};
