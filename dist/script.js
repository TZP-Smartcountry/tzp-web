var email = ""
var map = ""
var zones = []
var parkings = []

function login() {
    email = document.getElementById("inputEmail").value
    document.getElementById("login").style.display = "none"

    var oReq = new XMLHttpRequest()
    oReq.addEventListener("load", function () {
        zones = JSON.parse(this.responseText).sort(function (a, b) {
            var statusA = determineStatus(a.signature)
            var statusB = determineStatus(b.signature)
            if (statusA == statusB) { return 0 }
            if (statusA == "PENDING" && statusB != "PENDING") { return -1 }
            if (statusB == "PENDING" && statusA != "PENDING") { return 1 }
            return 0
        })
        parseZones()
    });
    oReq.open("GET", "https://7f8f3173.ngrok.io/api/zones/all")
    oReq.setRequestHeader("user", email)
    oReq.send()
    initMap()
}

function parseZones() {
    var items = []
    zones.forEach(zone => {
        items.push(`
            <a id="list-element-${zone.id}" class="list-group-item list-group-item-action flex-column align-items-start" onclick="zoneClicked('${zone.id}')">
                <div class="row">
                    <div class="col-sm-6">
                        <h5 class="">${zone.address.street} ${zone.address.number}</h5>
                    </div>
                    <div class="col-sm-6 align-self-center" style="margin-top: 9px">
                        <p class="text-right">${zone.length} Meter</p>
                    </div>
                </div>
                <div class="row">
                    <div class="col-sm-6">
                        <p>${zone.time.startDate}<br>${zone.time.endDate}</p>
                    </div>
                    <div class="col-sm-6">
                        <p class="text-right">${zone.time.startTime}<br>${zone.time.endTime}</p>
                    </div>
                </div>
                <div class="row">
                    <div class="col-sm-6" style="margin-top: 5px">
                        <small>${zone.author}</small>
                    </div>
                    <div class="col-sm-6">
                        <p class="material-icons text-right" style="display:block; color:${determineColor(determineStatus(zone.signature))}">${determineIcon(determineStatus(zone.signature))}</p>
                    </div>
                </div>
            </a>
            `)
    });
    document.getElementById("list").innerHTML = ""
    document.getElementById("list").innerHTML = items.join("")
    drawZones()
}

function initMap() {
    var center = { lat: 52.520008, lng: 13.404954 }
    map = new google.maps.Map(
        document.getElementById('map'), { zoom: 10, center: center });
}

function drawZones() {
    zones.forEach(function (zone) {
        var line = new google.maps.Polyline({
            path: zone.location.coordinates.map(function (coordinate) {
                return { lat: coordinate[0], lng: coordinate[1] }
            }),
            geodesic: true,
            strokeColor: determineColor(determineStatus(zone.signature)),
            strokeOpacity: 1.0,
            strokeWeight: 5
        });
        line.setMap(map)
    })
}

function determineStatus(signature) {
    if (signature == null || signature.status == "PENDING") {
        return "PENDING"
    } else if (signature.status == "APPROVED") {
        return "APPROVED"
    } else if (signature.status == "DENIED") {
        return "DENIED"
    }
}

function determineColor(status) {
    if (status == "PENDING") {
        return "#6c757d"
    } else if (status == "APPROVED") {
        return "#28a745"
    } else if (status == "DENIED") {
        return "#dc3545"
    }
}

function determineIcon(status) {
    if (status == "PENDING") {
        return "help_outline"
    } else if (status == "APPROVED") {
        return "check_circle_outline"
    } else if (status == "DENIED") {
        return "not_interested"
    }
}

function zoneClicked(zoneId) {
    var zone = zones.find(function (zone) {
        return zone.id == zoneId
    })
    centerMap(zone)
    setReason(zone)
    getParking(zone)
    getUtilization(zone)
    Array.from(document.getElementById("list").children).forEach(function (listElement) {
        listElement.classList.remove("active")
    })
    document.getElementById(`list-element-${zoneId}`).classList.add("active")
}

function getParking(zone) {
    var oReq = new XMLHttpRequest()
    oReq.addEventListener("load", function () {
        parkings = JSON.parse(this.responseText).parkingAreas
        parseParking()
        getTrend(zone)
    });
    oReq.open("POST", `https://api.aipark.de:443/aipark/v1/getParkingAreasForPosition`)
    oReq.setRequestHeader("apikey", "smart_country_hack")
    oReq.setRequestHeader("Content-Type", "application/json")
    oReq.send(
        JSON.stringify({
            filters: [],
            numberOfParkingAreas: 10,
            position: {
                type: "Point",
                coordinates: [zone.location.coordinates[0][1], zone.location.coordinates[0][0]]
            }
        }))
}

function parseParking() {
    var ctx = document.getElementById("parking-types-chart");

    var labels = parkings.map(function (parking) {
        return parking.parkingAreaType
    }).filter(onlyUnique)

    var data = labels.map(function (parkingAreaType) {
        return count(parkings, function (area) {
            return area.parkingAreaType == parkingAreaType
        })
    })

    var chartData = {
        datasets: [{
            data: data,
            backgroundColor: ["#23C9FF", "#7CC6FE", "#CCD5FF", "#E7BBE3", "#C884A6"]
        }],

        labels: labels
    };
    var myDoughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
            legend: {
                display: true,
                position: 'right'
            },
            animation: {
                duration: 0
            }
        }
    });
}

function getUtilization(zone) {
    var oReq = new XMLHttpRequest()
    oReq.addEventListener("load", function () {
        var uti = determineUtilizationDescriptor(parseInt(JSON.parse(this.responseText).value))
        document.getElementById("average-uti").innerText = uti.label
        document.getElementById("average-uti").style.color = uti.color
    });
    oReq.open("POST", `https://api.aipark.de:443/aipark/v1/getOccupancyForPosition`)
    oReq.setRequestHeader("apikey", "smart_country_hack")
    oReq.setRequestHeader("Content-Type", "application/json")
    oReq.send(
        JSON.stringify({
            timestamp: parseDate(zone.time.startDate, zone.time.startTime).getTime(),
            position: {
                type: "Point",
                coordinates: [zone.location.coordinates[0][1], zone.location.coordinates[0][0]]
            }
        }))
}

function parseDate(date, time) {
    var result = new Date(date)
    result.setHours(time.split(":")[0])
    result.setMinutes(time.split(":")[1])
    return result
}

function determineUtilizationDescriptor(occupancy) {
    if (occupancy > 85) {
        return { label: "niedrig", color: "#28a745" }
    } else if (occupancy > 40) {
        return { label: "mittel", color: "#ffc107" }
    } else {
        return { label: "hoch", color: "#dc3545" }
    }
}

function getTrend(zone) {
    var ctx = document.getElementById("trend-chart").getContext("2d");;

    var times = []

    for (let hour = zone.time.startTime.split(":")[0]; hour <= zone.time.endTime.split(":")[0]; hour++) {
        times.push(`${hour}:${zone.time.startTime.split(":")[1]}`)
    }

    var oReq = new XMLHttpRequest()
    oReq.addEventListener("load", function () {
        var data = JSON.parse(this.responseText).occupancies.map(function (pArea) {
            return 100 - pArea.value
        })

        var gradientStroke = ctx.createLinearGradient(0, 0, 400, 0);
        data.forEach(function(uti, i) {
            gradientStroke.addColorStop(1.0 / (data.length -1) * i, determineUtilizationDescriptor(100 - uti).color)
        })

        var chartData = {
            labels: times,
            datasets: [{ label: "Kapazität im Tagesverlauf", data: data, fill: false, borderColor: gradientStroke, lineTension: 0.0 }]
        }
        var myDoughnutChart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                legend: {
                    display: false
                },
                animation: {
                    duration: 0
                },
                scales: {
                    yAxes: [{
                        ticks: {
                            min:0,
                            max: 100,
                            display: false
                        }
                    }]
                }
            }
        });
    });
    oReq.open("POST", `https://api.aipark.de:443/aipark/v1/getOccupancyForParkingAreas`)
    oReq.setRequestHeader("apikey", "smart_country_hack")
    oReq.setRequestHeader("Content-Type", "application/json")
    oReq.send(
        JSON.stringify({
            timeParkingAreaId: times.map(function (time) {
                return {
                    parkingAreaId: parkings[0].id,
                    timestamp: parseDate(zone.time.startDate, time).getTime()
                }
            })
        }))
}

function setReason(zone) {
    var status = determineStatus(zone.signature)
    if (status == "PENDING") {
        document.getElementById("details").classList.remove("d-none")
        document.getElementById("reason-buttons").classList.remove("d-none")
        document.getElementById("reason").disabled = false
        document.getElementById("reason").value = ""
        document.getElementById("details-status").innerText = "Status: In Bearbeitung"
        document.getElementById("details-zone-id").value = zone.id
    } else {
        document.getElementById("details").classList.remove("d-none")
        document.getElementById("reason-buttons").classList.add("d-none")
        document.getElementById("reason").value = zone.signature.details
        document.getElementById("reason").disabled = true
        if (status == "APPROVED") {
            document.getElementById("details-status").innerText = "Status: Genehmigt"
        } else {
            document.getElementById("details-status").innerText = "Status: Abgelehnt"
        }
    }
}

function denyZone() {
    editZoneStatus("DENIED")
}

function approveZone() {
    editZoneStatus("APPROVED")
}

function editZoneStatus(targetStatus) {
    var zoneId = document.getElementById("details-zone-id").value
    var details = document.getElementById("reason").value
    var zone = zones.find(function (zone) {
        return zone.id == zoneId
    })
    var oReq = new XMLHttpRequest()
    oReq.addEventListener("load", function () {
        zone.signature = {
            status: targetStatus,
            author: email,
            details: details
        }
        parseZones()
        zoneClicked(zoneId)
    });
    oReq.open("POST", `https://7f8f3173.ngrok.io/api/zones/${zoneId}`)
    oReq.setRequestHeader("user", email)
    oReq.setRequestHeader("Content-Type", "application/json")
    oReq.send(
        JSON.stringify({
            status: targetStatus,
            details: details
        }))
}

function centerMap(zone) {
    map.setCenter({ lat: zone.location.coordinates[0][0], lng: zone.location.coordinates[0][1] })
    map.setZoom(18)
}

function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

function count(array, predicate) {
    return array.reduce(function (n, el) {
        return n + predicate(el)
    }, 0)
}