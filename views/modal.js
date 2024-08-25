var modal = document.getElementById("myModal");
var modalText = document.getElementById("modalText");
var span = document.getElementsByClassName("close")[0];

// Function to open modal
function openModal(text) {
    modalText.innerText = text;
    modal.style.display = "block";
}

// Function to close modal
function closeModal() {
    modal.style.display = "none";
}

// When the user clicks on <span> (x), close the modal
span.onclick = function() {
    closeModal();
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}