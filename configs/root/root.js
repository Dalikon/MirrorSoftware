async function fetchConfig(name = "") {
    // Get the name of the current script file without the .js extension
    const clientName = document.getElementById("clientName").src.split('/').pop().replace('.js', '');
    let jsonUrl;
    if (name === "") {
        console.log("Fetching mirror specific config")
        // Construct the URL to the JSON file
        jsonUrl = `${clientName}.json`;
    } else {
        console.log(`Fetching user config: ${name}.json`)
        const userName = name;
        jsonUrl = `/users/${userName}.json`;
    }

    // Fetch and parse the JSON file
    try {
        // Fetch and parse the JSON file
        console.log(jsonUrl)
        const response = await fetch(jsonUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(data)
        return data
    } catch (error) {
        console.error('Error fetching the JSON file:', error);
    }

    console.log("fetched mirror specific log")
}
