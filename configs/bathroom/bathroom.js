const clientConfig = {
    	modules: [
		{
			module: "updatenotification",
			position: "top_center"
		},
		{
			module: "helloworld",
			position: "upper_third",
			classes: "large thin",
			config: {
				text: "MagicMirror²"
			}
		},
		{
			module: "helloworld",
			position: "middle_center",
			config: {
				text: "Please create a config file or check the existing one for errors."
			}
		},
		{
			module: "helloworld",
			position: "middle_center",
			classes: "small dimmed",
			config: {
				text: "See README for more information."
			}
		},
		{
			module: "helloworld",
			position: "middle_center",
			classes: "xsmall",
			config: {
				text: "If you get this message while your config file is already created,<br>" + "it probably contains an error. To validate your config file run in your MagicMirror² directory<br>" + "<pre>npm run config:check</pre>"
			}
		},
		{
			module: "helloworld",
			position: "bottom_bar",
			classes: "xsmall dimmed",
			config: {
				text: "www.michaelteeuw.nl"
			}
		}
	],

}
