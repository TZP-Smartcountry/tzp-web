var email = ""
var map = ""
var zones = []

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
            strokeWeight: 2
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
    Array.from(document.getElementById("list").children).forEach(function (listElement) {
        listElement.classList.remove("active")
    })
    document.getElementById(`list-element-${zoneId}`).classList.add("active")
}

function getParking(zone) {
    oReq.addEventListener("load", function () {
        console.log(this.responseText)
    });
    oReq.open("POST", `https://api.aipark.de:443/aipark/v1/getParkingAreasForPosition`)
    oReq.setRequestHeader("apikey", "smart_country_hack")
    oReq.setRequestHeader("Content-Type", "application/json")
    oReq.send(
        JSON.stringify({
            filter: ["NOT_PRIVATE"]],
            details: details
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
    map.setZoom(16)
}