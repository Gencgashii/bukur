import Medusa from "@medusajs/medusa-js";

const medusa = new Medusa({
  baseUrl: "http://127.0.0.1:9000",
  maxRetries: 3,
  publishableApiKey: "pk_9f814f01f0d29d23cadc137e19b89a0a1f97eceae91382099074319f94df3549"
});

async function checkPrices() {
  try {
    const res = await medusa.products.list({
      region_id: 'reg_01KJGNNB7F58NMWSGDHYTHGR0Q',
      fields: '*categories,id,title,description,thumbnail,*variants,*variants.prices,*images,*collection'
    });
    
    console.log("Found products:", res.products.length);
    if (res.products.length > 0) {
      console.log("First product variants:");
      const p = res.products[0];
      console.log(JSON.stringify(p.variants, null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

checkPrices();
