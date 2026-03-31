from math import radians, sin, cos, sqrt, atan2
from ortools.constraint_solver import pywrapcp
from ortools.constraint_solver import routing_enums_pb2
import openrouteservice

API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImFlZWZkYTljNDllMzRlNDlhOGIxNWYwZGZjYzk0OGQ5IiwiaCI6Im11cm11cjY0In0="

def normalize_location(point):
    """Accept [lat, lon] or [lon, lat] and normalize to (lon, lat)."""
    if not isinstance(point, (list, tuple)) or len(point) != 2:
        raise ValueError(f"Invalid location point format: {point}")

    a, b = point
    if not (isinstance(a, (int, float)) and isinstance(b, (int, float))):
        raise ValueError(f"Location coordinates must be numeric: {point}")

    # Latitude range -90 to 90; longitude range -180 to 180.
    if -90 <= a <= 90 and -180 <= b <= 180:
        # input was [lat, lon]
        return (b, a)
    if -180 <= a <= 180 and -90 <= b <= 90:
        # input was [lon, lat]
        return (a, b)

    raise ValueError(f"Location coordinates out of bounds: {point}")


def ors_matrix(locations):
    client = openrouteservice.Client(key=API_KEY)

    if not isinstance(locations, list) or len(locations) < 2:
        raise ValueError("locations must be a list of 2 or more points")

    coordinates = [normalize_location(point) for point in locations]

    matrix = client.distance_matrix(
        locations=coordinates,
        profile='driving-car',
        metrics=['distance', 'duration']
    )
    return matrix

# For geopspatial coordinates but doesnt account for road turns
# def haversine(p1, p2):
#     R = 6371
#     latitude1, longitude1 = radians(p1[0]), radians(p1[1])
#     latitude2, longitude2 = radians(p2[0]), radians(p2[1])
#     dlatitude = latitude2 - latitude1
#     dlongitude = longitude2 - longitude1
#     a = sin(dlatitude/2)**2 + cos(latitude1)*cos(latitude2)*sin(dlongitude/2)**2
#     c = 2 * atan2(sqrt(a), sqrt(1-a))
#     return R * c


def create_distance_matrix(locations):
    matrix = ors_matrix(locations)
    distance_matrix = matrix["durations"]
    return distance_matrix



def optimization_using_or(cluster_orders):
    if not isinstance(cluster_orders, list):
        raise ValueError("cluster_orders must be a list")

    if len(cluster_orders) == 0:
        return []

    if len(cluster_orders) == 1:
        only = cluster_orders[0]
        return [{
            "stop": 1,
            "order_id": only.get("id"),
            "location": only.get("location"),
        }]

    locations = [o["location"] for o in cluster_orders]

    distance_matrix = create_distance_matrix(locations)

    manager = pywrapcp.RoutingIndexManager(len(distance_matrix),1,0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(start_index,end_index):

        start_Node = manager.IndexToNode(start_index)
        end_Node = manager.IndexToNode(end_index)

        return int(distance_matrix[start_Node][end_Node])

    transit_callback_index = routing.RegisterTransitCallback(distance_callback) # To get the costs of the paths

    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index) 

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )

    solution = routing.SolveWithParameters(search_parameters)

    route = []

    if solution:

        index = routing.Start(0)
        step = 1

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            route.append({
                "stop": step,
                "order_id": cluster_orders[node]["id"],
                "location": cluster_orders[node]["location"]
            })
            step += 1
            index = solution.Value(routing.NextVar(index))
    return route
