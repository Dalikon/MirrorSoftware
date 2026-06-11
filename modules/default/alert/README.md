# Module: Alert

Displays notifications and blocking alerts triggered by other modules via the inter-module notification system. Ported from [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror).

## Usage

Add to a client's `defaultModules` or a user's `modules` config:

```json
{
    "module": "alert",
    "position": "fullscreen_above"
}
```

`fullscreen_above` is recommended — the alert module renders notifications outside the normal layout flow.

## Configuration

| Option | Default | Description |
|---|---|---|
| `effect` | `"slide"` | Animation for growl-style notifications. Options: `scale`, `slide`, `genie`, `jelly`, `exploader`, `bouncyflip` |
| `alert_effect` | `"jelly"` | Animation for blocking alerts |
| `display_time` | `3500` | How long a notification stays visible (ms) |
| `position` | `"center"` | Horizontal alignment of notifications: `left`, `center`, `right` |
| `welcome_message` | `false` | Message shown on startup. Set to a string or `false` to disable |

```json
{
    "module": "alert",
    "position": "fullscreen_above",
    "config": {
        "effect": "slide",
        "display_time": 4000,
        "welcome_message": "Mirror ready."
    }
}
```

## Sending a notification (growl-style)

Slides in from the edge, auto-dismisses after `timer` ms (or `display_time` if omitted).

```javascript
this.sendNotification("SHOW_ALERT", {
    type: "notification",
    title: "Module Name",
    message: "Something happened.",
    timer: 5000
});
```

| Field | Type | Description |
|---|---|---|
| `type` | `"notification"` | Required to trigger growl mode |
| `title` | string | Optional header text |
| `message` | string | Body text |
| `timer` | number (ms) | Override display time for this notification |

## Sending a blocking alert

Appears center-screen with a blur overlay over all other modules. Stays until dismissed (click, or `timer` expires).

```javascript
this.sendNotification("SHOW_ALERT", {
    type: "alert",
    title: "Warning",
    message: "Action required.",
    sender: "myModuleName",
    timer: 10000
});
```

Dismiss it manually before the timer (e.g. after user action):

```javascript
this.sendNotification("HIDE_ALERT", { sender: "myModuleName" });
```

| Field | Type | Description |
|---|---|---|
| `type` | `"alert"` | Required to trigger blocking mode |
| `title` | string | Optional header text |
| `message` | string | Body text |
| `imageUrl` | string | Optional image URL |
| `imageHeight` | string | Image height, defaults to `"80px"` |
| `sender` | string | Module name used to track and dismiss this specific alert |
| `timer` | number (ms) | Auto-dismiss after this duration. Omit to require manual `HIDE_ALERT` |

## Differences from MagicMirror²

- **HTML in title/message is always escaped** — content is treated as plain text for security. Pass pre-sanitized strings only.
- **Font Awesome icons (`imageFA`) are not supported** — use `imageUrl` for images.
- **`HIDE_ALERT` takes `{ sender: "name" }`** — the original took a module object. Pass the same string used in `sender` when showing the alert.
- **No translations** — title and message strings are used as-is.

## Credits

Notification animations by [Codrops](https://tympanus.net/codrops/) (MIT licence).  
Original module by the [MagicMirror² project](https://github.com/MagicMirrorOrg/MagicMirror) (MIT licence).
