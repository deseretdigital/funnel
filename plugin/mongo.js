var shared = require('./shared');

module.exports = function (service) {
    var pending = 0;

    var doCount = function (conn, from, funneler, serviceName, thisService) {
        conn.collection(serviceName, function (err, coll) {
            pending++;
            coll.count(function (err, count) {
                pending--;
                funneler({
                    'funnel': 'mongo',
                    'nodeName': from.replace(/^mongodb:\/\//, ''),
                    'serviceName': serviceName,
                    'metricName': 'count',
                    'reading': count
                });
                if (pending == 0) {
                    conn.close();
                }
            });
        });
    };

    var doQuery = function (conn, from, funneler, serviceName, thisService) {
        conn.collection(thisService.collection, function (err, coll) {
            pending++;
            coll.count(thisService.query, function (err, count) {
                pending--;
                funneler({
                    'funnel': 'mongo',
                    'nodeName': from.replace(/^mongodb:\/\//, ''),
                    'serviceName': serviceName,
                    'metricName': 'query',
                    'reading': count
                });
                if (pending == 0) {
                    conn.close();
                }
            });
        });
    };

    var doAggregate = function (conn, from, funneler, serviceName, thisService) {
        conn.collection(thisService.collection, function (err, coll) {
            pending++;
            coll.aggregate(thisService.aggregate, function (err, result) {
                pending--;
                if (result) {
                    funneler({
                        'funnel': 'mongo',
                        'nodeName': from.replace(/^mongodb:\/\//, ''),
                        'serviceName': serviceName,
                        'metricName': 'aggregate',
                        'reading': thisService.processor(result),
                    });
                }
                if (pending == 0) {
                    conn.close();
                }
            });
        });
    };

    return function(funneler) {
        if (typeof service.from == 'string') {
            service.from = [service.from];
        }
        var mongodb = require('mongodb');
        service.from.forEach(function (from) {
            mongodb.connect(from, function(err, conn) {

                for (var serviceName in service.services) {
                    (function (thisService) {
                        if (thisService === shared.COUNT || thisService.count) {
                            doCount(conn, from, funneler, serviceName, thisService);
                        } else if (thisService.query) {
                            doQuery(conn, from, funneler, serviceName, thisService);
                        } else if (thisService.aggregate) {
                            doAggregate(conn, from, funneler, serviceName, thisService);
                        }
                    })(service.services[serviceName]);
                }

            });

        });

    };
};

