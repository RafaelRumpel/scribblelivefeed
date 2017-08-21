Scribble Live Feed Widget
===========
The Scribble Live Feed Widget, create a news feed with the most recent posts in your ScribbleLive Stream.
This project is a fork of the recent-posts widget by Matt Mccausland.

## Getting started

Add the main scribblelivefeed.js to the head of your page, and the tag below wherever you like below that.

```HTML
<script type="text/javascript">

    var ScribbleLiveInstance = new ScribbleLiveFeed({
        APIToken: "",
        EventId: "",
        TotalPostsToShow: 10,
        WhereToAddPosts: ""

    });

</script>
```

###The Script Tag Break Down


__var ScribbleLiveInstance = new ScribbleLiveFeed__

The variable name can be anything you like. It allows you to add more than one of these widgets to the same page. Give each instance a different variable name and you're good to go.

__APIToken__

To get an API token you must have a ScribbleLive account. Log in to https://client.scribblelive.com, go to the API section, and either grab a token if you already have one or generate a new one.

__EventId__

The id of the ScribbleLive event you would like to display. You can find this by logging in to https://client.scribblelive.com, and going to the API section of your event. The id it at the top of the API section.

__TotalPostsToShow__

The number of posts you'd like to show in integer form. If left blank it will default to 10. On load it will load the newest x posts. It will keep the list at x posts by deleting the older posts as new posts are added.

__WhereToAddPosts__

This is the id of the DOM element on your page that you would like to add the list of posts to. No hash tag required, just "DOMElementID".
That's It!

__There is a lot of other options for you to customize your widget!

__Add the scripts to your page, set the options correctly, and you're good to go.__

