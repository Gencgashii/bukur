import fetch from 'node-fetch';

async function testOrder() {
    const payload = {
        customerName: "Genc Gashi",
        customerEmail: "genc@bukur.com",
        paymentMethod: "card",
        shippingAddress: {
            address: "Kodra e Trimave",
            city: "Prishtine",
            postalCode: "10000",
            state: "Kosovo"
        },
        items: [
            {
                id: "prod_01KJWB",
                name: "L AMOUR DRESS",
                price: 1799.94,
                quantity: 1,
                size: "One Size"
            }
        ]
    };

    try {
        const response = await fetch('http://localhost:9000/store/custom/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.text();
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${data}`);
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

testOrder();
