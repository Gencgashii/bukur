async function run() {
  try {
    const res = await fetch('http://localhost:9000/store/custom/promotions', {
      headers: {
        'x-publishable-api-key': 'pk_9f814f01f0d29d23cadc137e19b89a0a1f97eceae91382099074319f94df3549'
      }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

run().then(() => process.exit(0));
