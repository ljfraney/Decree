VSS.init();

VSS.ready(function() {
    document.getElementById("name").innerText = VSS.getWebContext().user.name;
});