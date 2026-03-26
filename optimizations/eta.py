import openrouteservice

API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImFlZWZkYTljNDllMzRlNDlhOGIxNWYwZGZjYzk0OGQ5IiwiaCI6Im11cm11cjY0In0="

client = openrouteservice.Client(key=API_KEY)


def get_travel_time(origin, destination):

    coords = [
        (origin[1], origin[0]),
        (destination[1], destination[0])
    ]

    route = client.directions(
        coordinates=coords,
        profile="driving-car",
        format="json"
    )

    duration = route["routes"][0]["summary"]["duration"]

    return duration  # seconds


def calculate_eta(route, service_time=120):

    eta_seconds = 0
    results = []

    for i in range(len(route)):

        if i > 0:

            origin = route[i-1]["location"]
            destination = route[i]["location"]

            travel_time = get_travel_time(origin, destination)

            eta_seconds += travel_time

        eta_seconds += service_time

        results.append({
            "order_id": route[i]["order_id"],
            "minutes_left": round(eta_seconds / 60, 2)
        })

    return results