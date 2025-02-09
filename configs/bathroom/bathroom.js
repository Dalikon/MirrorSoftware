async function fetchConfig(name = "", otherClient = false, user = false, userName = "") {
    // Get the name of the current script file without the .js extension
    let jsonUrl;
    if (!user && !otherClient) {
        console.log("Fetching mirror specific config")
        // Construct the URL to the JSON file
        jsonUrl = `${name}.json`;
        try {
            // Fetch and parse the JSON file
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data
        } catch (error) {
            console.error('Error fetching the JSON file:', error);
        }

    } else if (!user && otherClient) {
        console.log("Fetching other mirror specific config")
        jsonUrl = `/configs/${name}/${name}.json`;
        // Fetch and parse the JSON file
        try {
            // Fetch and parse the JSON file
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data
        } catch (error) {
            console.error('Error fetching the JSON file:', error);
        }

        console.log("fetched mirror specific log")
    } else {
        console.log(`Fetching user config: ${userName}.json`)
        //jsonUrl = `/users/${userName}.json`;
        try {
            const response = await fetch(`/get-user/${encodeURIComponent(userName)}`, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain", // Ensure correct content type
                },
                body: name, // Send clientName as raw text
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to fetch user config");
            }

            const userConfig = await response.json();
            return userConfig;
        } catch (error) {
            console.error("Error fetching user config:", error.message);
            return null;
        }
    }


}
