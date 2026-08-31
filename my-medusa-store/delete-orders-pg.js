const { Client } = require('pg');

async function wipeOrders() {
    const client = new Client({
        connectionString: 'postgres://postgres:WebGenc2%2F2@localhost/medusa-my-medusa-store',
    });

    try {
        await client.connect();
        console.log("Connected to PostgreSQL database.");

        console.log("Starting deletion of test orders...");

        // We disable foreign key checks temporarily, or cascade delete
        // The easiest way is to delete from order_item first, then order.
        // In Medusa v2 the table name for orders is typically `order`

        // First, let's find the exact table names
        const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name ILIKE '%order%';
    `);

        console.log("Order-related tables found:", tablesRes.rows.map(r => r.table_name).join(", "));

        // Safe wipe of typical order tables. We use CASCADE to drop dependent records like line items, shipping addresses, etc.
        await client.query(`TRUNCATE TABLE "order" CASCADE;`);

        console.log("✅ All orders and their related data have been successfully deleted via TRUNCATE CASCADE!");

    } catch (err) {
        console.error("Error wiping orders:", err);
    } finally {
        await client.end();
    }
}

wipeOrders();
