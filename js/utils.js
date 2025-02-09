function resetDOM() {
    let oldRegions = document.getElementById('all-regions');
    oldRegions.innerHTML = freshRegions;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTime(timeStamp) {
    const date = new Date(timeStamp);

    // Get hours, minutes, seconds
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    // Get day and month
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    // Format the date as H:M:S D.M.
    return `${day}.${month}. ${hours}:${minutes}:${seconds}`;
}
