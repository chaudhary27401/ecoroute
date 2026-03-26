from sklearn.cluster import KMeans
import numpy as np
from collections import defaultdict
from math import sqrt

def euclidean(a,b):
    return sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2)

def cluster_orders(orders, num_drivers):

    matrix = np.array([o["location"] for o in orders])

    model = KMeans(
        n_clusters=num_drivers,
        init="k-means++",
        n_init=20,
        max_iter=300,
        random_state=72
    )

    labels = model.fit_predict(matrix)
    centroids = model.cluster_centers_

    groups = group_by_clusters(orders, labels)

    max_orders = int(np.ceil(len(orders)/num_drivers))

    balanced = balance_clusters(groups, centroids, max_orders)

    assign_cluster_to_drivers = {}

    for driver_id, cluster_id in enumerate(balanced):
        assign_cluster_to_drivers[driver_id] = balanced[cluster_id]

    return assign_cluster_to_drivers


def group_by_clusters(orders, labels):

    groups = defaultdict(list)

    for i, cluster in enumerate(labels):
        groups[cluster].append(orders[i])

    return groups


def balance_clusters(groups, centroids, max_orders):

    clusters = dict(groups)

    for cluster_id in clusters:

        while len(clusters[cluster_id]) > max_orders:

            centroid = centroids[cluster_id]

            farthest = max(
                clusters[cluster_id],
                key=lambda p: euclidean(p["location"], centroid)
            )

            clusters[cluster_id].remove(farthest)

            nearest_cluster = min(
                clusters.keys(),
                key=lambda c: euclidean(farthest["location"], centroids[c]) 
                if len(clusters[c]) < max_orders else float('inf')
            )

            clusters[nearest_cluster].append(farthest)

    return clusters