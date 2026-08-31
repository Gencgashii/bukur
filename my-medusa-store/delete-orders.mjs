import { initialize } from "@medusajs/order";
import { resolve } from "path";

async function deleteAllOrders() {
    console.log("Initializing Medusa Order Service...");

    // The PostgreSQL connection string from your env
    const connectionUrl = "postgres://postgres:WebGenc2%2F2@localhost/medusa-my-medusa-store";

    try {
        const orderService = await initialize({
            database: {
                clientUrl: connectionUrl,
            },
        });

        console.log("Fetching all orders...");
        const orders = await orderService.listOrders({}, { take: 1000 });

        if (orders.length === 0) {
            console.log("No orders found to delete.");
            return;
        }

        console.log(`Found ${orders.length} orders. Deleting them one by one...`);

        // We cannot hard delete easily without wiping constraints.
        // However, Medusa v2 provides a 'softDeleteOrders' method or we can delete them by ID.
        const orderIds = orders.map(o => o.id);
        await orderService.deleteOrders(orderIds);

        console.log("✅ All test orders have been successfully deleted from the database!");

    } catch (error) {
        console.error("❌ Failed to delete orders:", error);
    }
}

deleteAllOrders();
