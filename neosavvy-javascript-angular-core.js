/*! neosavvy-javascript-angular-core - v0.1.0 - 2013-09-29
* Copyright (c) 2013 Neosavvy, Inc.; Licensed  */
var Neosavvy = Neosavvy || {};
Neosavvy.AngularCore = Neosavvy.AngularCore || {};
Neosavvy.AngularCore.Directives = angular.module('neosavvy.angularcore.directives', []);
Neosavvy.AngularCore.Filters = angular.module('neosavvy.angularcore.filters', []);
Neosavvy.AngularCore.Services = angular.module('neosavvy.angularcore.services', []);

Neosavvy.AngularCore.Directives
    .directive('nsInlineHtml',
    ['$compile',
        function ($compile) {
            return {
                restrict:'E',
                template:'<div></div>',
                replace:true,
                scope:false,
                link:function (scope, element, attrs) {
                    var value = attrs.value || false;
                    if (!value) {
                        throw "You must provide an html value on the scope in order to bind inline html!";
                    }
                    var dereg = scope.$watch(value, function (value) {
                        if (value) {
                            element.replaceWith($compile(angular.element(value))(scope));
                            dereg();
                        }
                    });
                }
            }
        }]);
Neosavvy.AngularCore.Directives
    .directive('nsStaticInclude',
    ['$http', '$templateCache', '$compile',
        function ($http, $templateCache, $compile) {
            return {
                restrict:'E',
                template:'<div></div>',
                replace:true,
                scope:false,
                compile:function (tElement, tAttrs) {
                    if (_.isEmpty(tAttrs.src)) {
                        throw "You must pass in a source to render a Neosavvy static include directive.";
                    }

                    var waitFor = tAttrs.waitFor,
                        watchWaitFor = tAttrs.watchWaitFor,
                        waitForRender = tAttrs.waitForRender,
                        watchWaitForRender = tAttrs.watchWaitForRender;

                    //If there are no 'waiting' indicators, warm up the cache, by requesting the template
                    if (_.isEmpty(waitFor) && _.isEmpty(watchWaitFor)) {
                        $http.get(tAttrs.src, {cache:$templateCache});
                        if (!_.isEmpty(watchWaitForRender)) {
                            watchWaitFor = watchWaitForRender;
                        } else if (!_.isEmpty(waitForRender)) {
                            waitFor = waitForRender;
                        }
                    }

                    //Return link function
                    return function (scope, element, attrs) {
                        var replace = function (result) {
                            element.replaceWith($compile(angular.element(result.data))(scope));
                        };
                        var dereg, request = function () {
                            $http.get(attrs.src, {cache:$templateCache}).then(replace);
                            if (dereg) {
                                dereg();
                            }
                        };

                        if (!_.isEmpty(watchWaitFor)) {
                            dereg = scope.$watch(watchWaitFor, request);
                        }
                        else if (!_.isEmpty(waitFor) && parseFloat(waitFor) > 0) {
                            setTimeout(request, parseFloat(waitFor));
                        } else {
                            request();
                        }

                    };
                }
            }
        }]);

Neosavvy.AngularCore.Directives
    .directive('nsEvent', ['$rootScope', function ($rootScope) {
    return {
        restrict:'A',
        scope:false,
        link:function (scope, element, attrs) {
            var nsEvent = attrs.nsEvent.replace(/ /g, '').split(",");
            var bindFirst = (!_.isUndefined(attrs.nsEventHighPriority) ? true : false);
            if (nsEvent.length < 2) {
                throw "Specify and event and handler in order to use the ns-event directive!";
            }

            function matchKey(key) {
                return key.match(/.*?(?=\(|$)/i)[0];
            }

            function findScope(scope, name) {
                if (!_.isUndefined(scope[matchKey(name)])) {
                    return scope;
                } else if (scope.$parent) {
                    return findScope(scope.$parent, name);
                } else {
                    throw "Your handler method has not been found in the scope chain, please add " + name + " to the scope chain!";
                }
            }

            function handler(e) {
                var myScope = findScope(scope, nsEvent[1]);
                myScope.$event = e;
                myScope.$apply(nsEvent[1]);
            }

            //Initialize event listeners
            if (nsEvent.length === 2) {
                if (bindFirst) {
                    element.bindFirst(nsEvent[0], handler);
                } else {
                    element.bind(nsEvent[0], handler);
                }
            } else {
                for (var i = 2; i < nsEvent.length; i++) {
                    var selector = $(element).find(nsEvent[i]);
                    if (bindFirst) {
                        selector.bindFirst(nsEvent[0], handler);
                    } else {
                        selector.bind(nsEvent[0], handler);
                    }
                }
            }
        }
    }
}]);
Neosavvy.AngularCore.Directives
    .directive('nsModelOnblur', function () {
        return {
            restrict:'A',
            require:'ngModel',
            link:function (scope, elm, attr, ngModelCtrl) {
                if (attr.type === 'radio' || attr.type === 'checkbox') return;

                elm.unbind('input').unbind('keydown').unbind('change');
                elm.bind('blur', function () {
                    scope.$apply(function () {
                        ngModelCtrl.$setViewValue(elm.val());
                    });
                });
            }
        };
    });
Neosavvy.AngularCore.Services.factory('nsServiceExtensions',
    ['$q', '$http',
        function ($q, $http) {
            /**
             * Parse headers into key value object
             *
             * @param {string} headers Raw headers as a string
             * @returns {Object} Parsed headers as key value object
             */
            function parseHeaders(headers) {
                var parsed = {}, key, val, i;

                if (!headers) return parsed;

                forEach(headers.split('\n'), function (line) {
                    i = line.indexOf(':');
                    key = lowercase(trim(line.substr(0, i)));
                    val = trim(line.substr(i + 1));

                    if (key) {
                        if (parsed[key]) {
                            parsed[key] += ', ' + val;
                        } else {
                            parsed[key] = val;
                        }
                    }
                });

                return parsed;
            }

            function getFromCache(params) {
                if (params.cache && params.method === 'GET') {
                    var cached = params.cache.get(params.url);
                    if (cached && cached.length) {
                        return cached;
                    }
                }
                return undefined;
            }

            function storeInCache(params, status, response, headers) {
                if (params.cache && params.method === 'GET') {
                    params.cache.put(params.url, [status, response, parseHeaders(headers)]);
                }
            }

            return {
                /**
                 * @ngdoc method
                 * @name neosavvy.angularcore.services.services:nsServiceExtensions#request
                 * @methodOf neosavvy.angularcore.services.services:nsServiceExtensions
                 *
                 * @description
                 * The standard $http request method helper with error handling, transformers, and added response handlers.
                 *
                 * @param {Object} parameters all service parameters
                 * @param {Function} additionalSuccess additional success method
                 * @param {function} additionalError additonal error method
                 * @returns {Promise} $q promise object
                 */
                request: function (params, additionalSuccess, additionalError) {
                    if (!params.method) {
                        throw "You must provide a method for each service request.";
                    }
                    if (!params.url) {
                        throw "You must provide a url for each service request.";
                    }

                    var deferred = $q.defer();
                    $http(params).
                        success(function (data, status, headers, config) {
                            deferred.resolve(data);
                            if (additionalSuccess) {
                                additionalSuccess(data);
                            }
                        }).
                        error(function (data, status, headers, config) {
                            deferred.reject(data);
                            if (additionalError) {
                                additionalError(data);
                            }
                        });

                    return deferred.promise;
                },
                /**
                 * @ngdoc method
                 * @name neosavvy.angularcore.services.services:nsServiceExtensions#xhr
                 * @methodOf neosavvy.angularcore.services.services:nsServiceExtensions
                 *
                 * @description
                 * The native XHR request method helper with error handling, transformers, and added response handlers.
                 *
                 * @param {Object} params all service params
                 * @returns {Promise} Q promise object
                 */
                xhr: function (params) {
                    if (!params.method) {
                        throw "You must provide a method for each service request.";
                    }
                    if (!params.url) {
                        throw "You must provide a url for each service request.";
                    }

                    var deferred = Q.defer();
                    var cached = getFromCache(params);
                    if (cached) {
                        //cached[0] is status, cached[1] is response, cached[2] is headers
                        deferred.resolve(cached[1]);
                    } else {
                        var xhr = new XMLHttpRequest();
                        xhr.onreadystatechange = function () {
                            if (xhr.readyState === 4) {
                                var resp = xhr.responseText;
                                if (xhr.status === 200) {
                                    storeInCache(params, xhr.status, resp, xhr.getAllResponseHeaders());

                                    if (params.transformResponse) {
                                        resp = params.transformResponse(resp);
                                    } else if (xhr.getResponseHeader("Content-Type") === "application/json") {
                                        resp = JSON.parse(resp);
                                    }

                                    deferred.resolve(resp, xhr.status, xhr.getAllResponseHeaders());
                                } else {
                                    deferred.reject(resp, xhr.status, xhr.getAllResponseHeaders());
                                }
                            }
                        };

                        xhr.onerror = function () {
                            deferred.reject(xhr, xhr.status, xhr.getAllResponseHeaders());
                        };

                        var data = params.data;
                        if (data) {
                            if (params.transformRequest) {
                                data = params.transformRequest(data);
                            } else if (!_.isString(data)) {
                                data = JSON.stringify(data);
                            }
                        }

                        xhr.open(params.method, params.url, true);
                        xhr.send(data);
                    }

                    return deferred.promise;
                }
            };
        }]);
