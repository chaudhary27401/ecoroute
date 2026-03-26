from clustering import cluster_orders
from routing import optimization_using_or
from eta import calculate_eta


def main():

    orders = [
        {"id": 1, "location": (28.6139, 77.2090)},
        {"id": 2, "location": (28.7041, 77.1025)},
        {"id": 3, "location": (28.5355, 77.3910)},
        {"id": 4, "location": (28.4595, 77.0266)},
        {"id": 5, "location": (28.6692, 77.4538)},
        {"id": 6, "location": (28.4089, 77.3178)}
    ]

    num_drivers = 2

    clusters = cluster_orders(orders, num_drivers)

    print("Clusters Assigned:")
    for driver, locations in clusters.items():

        print(f"\nDriver {driver}")

        for order in locations:
            print(f"Order {order['id']} -> {order['location']}")

    print("\nOptimized Routes + ETA:")

    for driver_id, cluster in clusters.items():

        route = optimization_using_or(cluster)

        etas = calculate_eta(route)

        print(f"\nDriver {driver_id} route:")

        for r, e in zip(route, etas):

            print(
                f"Stop {r['stop']} → Order {r['order_id']} at {r['location']} "
                f"| ETA: {e['minutes_left']} minutes"
            )


if __name__ == "__main__":
    main()