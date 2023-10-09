// @ts-check

function cloneDeep(object) {
	const clone = Array.isArray(object) ? [] : {};

	for (const [key, value] of Object.entries(object)) {
		if (Array.isArray(value)) {
			clone[key] = [];

			for (const element of value) {
				if (typeof element === "object" && element !== null) {
					clone[key].push(cloneDeep(element));
				} else {
					clone[key].push(element);
				}
			}
		} else if (typeof value === "object" && value !== null) {
			clone[key] = cloneDeep(value);
		} else {
			clone[key] = value;
		}
	}

	return clone;
}

function merge(target, source) {
	if (target === undefined) {
		target = Array.isArray(source) ? [] : {};
	}

	for (const [key, value] of Object.entries(source)) {
		if (Array.isArray(value)) {
			target[key] = [...(target[key] ?? []), ...value];
		} else if (typeof value === "object" && value !== null) {
			target[key] = merge(target[key], value);
		} else {
			target[key] = value;
		}
	}

	return target;
}

function mergeDeep(...args) {
	return args.reduce(function(previous, current) {
		if (previous === undefined) {
			previous = Array.isArray(current) ? [] : {};
		}

		merge(previous, current);

		return previous;
	});
}

let ChartType;

(function(ChartType) {
	ChartType["Area"] = "Area";
	ChartType["CategoricalBar"] = "CategoricalBar";
	ChartType["Donut"] = "Donut";
	ChartType["Gantt"] = "Gantt";
	ChartType["Gauge"] = "Gauge";
	ChartType["Line"] = "Line";
	ChartType["NpsGauge"] = "NpsGauge";
	ChartType["NpsTrending"] = "NpsTrending";
	ChartType["Pie"] = "Pie";
	ChartType["StatusPage"] = "StatusPage";
})(ChartType || (ChartType = {}));

const today = new Date();

const oneMonthAgo = new Date(today).setMonth(today.getMonth() - 1);

const oneYearAgo = new Date(today).setFullYear(today.getFullYear() - 1);
const twoYearsAgo = new Date(today).setFullYear(today.getFullYear() - 2);

function dayTicks(min, max = new Date()) {
	const values = [];

	for (let current = new Date(new Date(new Date(min).setDate(new Date(min).getDate() + 1)).setHours(0, 0, 0, 0)); current <= max; current = new Date(current.setDate(current.getDate() + 1))) {
		values.push(current.getTime());
	}

	return values;
}

function weekTicks(min, max = new Date()) {
	const values = [];

	for (let current = new Date(new Date(new Date(min).setDate(new Date(min).getDate() + (7 - (new Date(min).getDay() % 7)))).setHours(0, 0, 0, 0)); current <= max; current = new Date(current.setDate(current.getDate() + 7))) {
		values.push(current.getTime());
	}

	return values;
}

function monthTicks(min, max = new Date()) {
	const values = [];

	for (let current = new Date(new Date(new Date(min).setDate(1)).setHours(0, 0, 0, 0)); current <= max; current = new Date(current.setMonth(current.getMonth() + 1))) {
		values.push(current.getTime());
	}

	return values;
}

function yearTicks(min, max = new Date()) {
	const values = [];

	for (let current = new Date(new Date(min).getFullYear(), 0, 1); current <= max; current = new Date(current.setFullYear(current.getFullYear() + 1))) {
		values.push(current.getTime());
	}

	return values;
}

function gridify(input) {
	const lines = [];

	for (const date of input) {
		lines.push({
			"value": new Date(date).getTime(),
			"text": new Date(date).getFullYear()
		});
	}

	return lines;
}

function regionify(input) {
	const regions = [];

	for (let x = 0; x < input.length; x += 2) {
		regions.push({
			"start": input[x],
			"end": input[x + 1]
		});
	}

	return regions;
}

function handleMultiseries({ keys = {}, json }) {
	const data = {
		"keys": {
			"x": keys["x"] ?? !isNaN(Date.parse(Object.keys(json)[0])) ? "date" : undefined,
			"value": Object.keys(json[Object.keys(json)[0]])
		},
		"json": []
	};

	if (data.keys.x === undefined) {
		throw new Error("`data.keys.x` is required.");
	}

	for (const [key, values] of Object.entries(json)) {
		const datum = {
			[data.keys.x]: key
		};

		for (const [key, value] of Object.entries(values)) {
			datum[key] = value;
		}

		data.json.push(datum);
	}

	return data;
}

function buildChart(type, overrides = {}) {
	const chart = {};

	switch (type) {
		case ChartType.Area:
			chart.data = {
				"order": null
			};

			/*
			if (Array.isArray(overrides.data?.keys?.value) && overrides.data.keys.value.length === 1) {
				for (const datum of overrides.data.json) {
					const index = overrides.data.keys.value[0];

					if (!Array.isArray(datum[index])) {
						datum[index] = [].fill(datum[index], 0, 2)
					}
				}
			}
			*/

			chart.axis = {
				"x": {
					"type": "timeseries",
					"min": {
						"fit": true
					},
					"padding": {
						"left": 0,
						"right": 0
					},
					"tick": {
						"format": "%m/%d/%Y",
						"values": monthTicks(twoYearsAgo)
					}
				}
			};

			chart.grid = {
				"x": {
					"lines": gridify(yearTicks(twoYearsAgo))
				}
			};

			break;
		case ChartType.CategoricalBar:
			chart.data = {
				"order": null
			};

			chart.axis = {
				"x": {
					"type": "category"
				}
			};

			if (!Array.isArray(overrides.data.json) && Object.values(overrides.data.json).every((element) => !Array.isArray(element) && typeof element === "object" && element !== null)) {
				overrides.data = { ...overrides.data, ...handleMultiseries(overrides.data) };
			}

			break;
		case ChartType.Donut:
			if (!Object.values(overrides.data.json).every(Array.isArray)) {
				overrides.data.json = Object.fromEntries(Object.entries(overrides.data.json).map(function([key, value]) {
					return [key, [value]];
				}));
			}

			break;
		case ChartType.Gantt:
			chart.data = {
				"order": null
			};

			chart.axis = {
				"x": {
					"type": "category"
				},
				"y": {
					"max": today.getTime(),
					"padding": {
						"top": 0,
						"bottom": 0
					},
					"tick": {
						"format": function(index, categoryName) {
							return new Date(index).toLocaleDateString("en-US");
						}
					}
				},
				"rotated": true
			};

			chart.legend = {
				"hide": true
			};

			break;
		case ChartType.Gauge:
			chart.legend = {
				"show": false
			};

			break;
		case ChartType.Line:
			chart.axis = {
				"x": {
					"type": "timeseries"
				}
			};

			if (!Array.isArray(overrides.data.json) && Object.values(overrides.data.json).every((element) => !Array.isArray(element) && typeof element === "object" && element !== null)) {
				overrides.data = { ...overrides.data, ...handleMultiseries(overrides.data) };
			}

			break;
		case ChartType.NpsGauge:
			chart.gauge = {
				"label": {
					"extents": function(value, ratio) {
						return value - 100;
					},
					"format": function(value, ratio) {
						return String(value - 100);
					}
				},
				"min": 0,
				"max": 200
			};

			chart.legend = {
				"show": false
			};

			chart.tooltip = {
				"format": {
					"value": function(value, ratio) {
						return String(value - 100);
					}
				}
			};

			break;
		case ChartType.NpsTrending:
			chart.axis = {
				"x": {
					"type": "timeseries",
					"min": {
						"fit": true
					},
					"padding": {
						"left": 0,
						"right": 0
					},
					"tick": {
						"format": "%m/%d/%Y",
						"values": monthTicks(twoYearsAgo)
					}
				},
				"y": {
					"min": -100,
					"max": 100,
					"padding": {
						"top": 0,
						"bottom": 0
					}
				}
			};

			/*
			if (Array.isArray(overrides.data?.keys?.value) && overrides.data.keys.value.length === 1) {
				for (const datum of overrides.data.json) {
					const index = overrides.data.keys.value[0];

					if (!Array.isArray(datum[index])) {
						datum[index] = [].fill(datum[index], 0, 2)
					}
				}
			}
			*/

			chart.grid = {
				"x": {
					"lines": gridify(yearTicks(twoYearsAgo))
				},
				"y": {
					"lines": [
						{
							"value": 0
						}
					]
				}
			};

			break;
		case ChartType.StatusPage:
			chart.axis = {
				"x": {
					"type": "timeseries",
					"tick": {
						"show": false
					}
				},
				"y": {
					"padding": {
						"top": 0,
						"bottom": 0
					},
					"show": false
				}
			};

			chart.grid = {
				"x": {
					"lines": gridify(yearTicks(twoYearsAgo))
				}
			};

			chart.legend = {
				"show": false
			};

			break;
		default:
			throw new Error("Unrecognized chart type `" + type + "`.");
	}

	return mergeDeep(chart, overrides);
}

function area(selector, data, options = {}) {
	return buildChart(ChartType.Area, {
		...options,
		"bindto": selector,
		"data": {
			...(options?.data ?? {}),
			"type": "area",
			"json": data
		}
	});
}

function categoricalBar(selector, data, options = {}) {
	return buildChart(ChartType.CategoricalBar, {
		...options,
		"bindto": selector,
		"data": {
			...(options?.data ?? {}),
			"type": "bar",
			"json": data
		}
	});
}

function donut(selector, data, options = {}) {
	return buildChart(ChartType.Donut, {
		...options,
		"bindto": selector,
		"data": {
			...(options?.data ?? {}),
			"type": "donut",
			"json": data
		}
	});
}

function gantt(selector, data, options = {}) {
	return buildChart(ChartType.Gantt, {
		...options,
		"bindto": selector,
		"data": {
			...(options?.data ?? {}),
			"type": "bar",
			"json": data
		}
	});
}

function gauge(selector, data, options = {}) {
	return buildChart(ChartType.Gauge, {
		...options,
		"bindto": selector,
		"data": {
			...(options?.data ?? {}),
			"type": "gauge",
			"json": data
		}
	});
}

function line(selector, data, options = {}) {
	return buildChart(ChartType.Line, {
		...options,
		"bindto": selector,
		"data": {
			...(options?.data ?? {}),
			"type": "line",
			"json": data
		}
	});
}

function npsGauge(selector, data, options = {}) {
	return buildChart(ChartType.NpsGauge, {
		...options,
		"bindto": selector,
		"data": {
			...(options?.data ?? {}),
			"type": "gauge",
			"json": data
		}
	});
}

function npsTrending(selector, data, options = {}) {
	return buildChart(ChartType.NpsTrending, {
		...options,
		"bindto": selector,
		"data": {
			...(options?.data ?? {}),
			"type": "area",
			"json": data
		}
	});
}

function pie(selector, data, options = {}) {
	return buildChart(ChartType.NpsTrending, {
		...options,
		"bindto": selector,
		"data": {
			...(options?.data ?? {}),
			"type": "pie",
			"json": data
		}
	});
}

function statusPage(selector, data, options = {}) {
	return buildChart(ChartType.StatusPage, {
		...options,
		"bindto": selector,
		"data": {
			...(options?.data ?? {}),
			"type": "bar",
			"json": data
		}
	});
}
