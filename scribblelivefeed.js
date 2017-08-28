/*

Title: ScribbleLive Feed
Description: The Scribble Live Feed Widget, create a news feed with the most recent posts in your ScribbleLive Stream. This project is a fork of the recent-posts widget by Matt Mccausland.
Author: Rafael Rumpel
Github: https://github.com/RafaelRumpel/scribblelivefeed

*/

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.scribblelivefeed = factory()
}(this, (function () {

  var ScribbleLiveFeed = function (Options) {

    this.version = '2.1.2';

    this.Options = {
      // You can find your API tokens - and generate new ones - under the general API section of your ScribbleLive back end. https://client.scribblelive.com/client/API.aspx
      APIToken: '',
      // You can find your event id under the API section of your event in the ScribbleLive back end. You can also view source on your event and search for "ThreadId".
      EventId: '',
      // The number of posts you would like to display.
      PostsPerPage: 10,
      // The id of the element on your page where you would like to display the posts.
      WhereToAddPosts: '',
      // The number of seconds you want to check for new streams
      PoolingTime: 31000,
      // PoolingTime: 5000, //debug only
      // Show images, true or false.
      ShowImages: true,
      // Show videos, true or false.
      ShowVideos: true,
      // Show audio, true or false.
      ShowAudio: true,
      // Show stuck posts, true or false.
      ShowStuckPosts: true,
      // Show avatars, true or false.
      ShowAvatars: true,
      // Show text posts, true or false.
      ShowTextPosts: true,
      // Show media captions, true or false.
      ShowCaptions: true,
      // Show comments, true or false.
      ShowComments: true,
      // Show official (writer, editor, moderator, administrator, guest writer, etc.) posts, true or false.
      ShowOfficialPosts: true,
      // Show Twitter posts, true or false.
      ShowTwitterTweets: true,
      // Show mobile posts, true of false.
      ShowMobilePosts: true,
      // Show Facebook posts, true or false.
      ShowFacebookPosts: true,
      // Show only Twitter posts, true or false.
      ShowOnlyTweets: false,
      // Show only Facebook posts, true or false.
      ShowOnlyFacebookPosts: false,
      // CSS classes
      WidgetClass: 'scribble-posts-wrapper',
      PinnedListClass: 'scribble-pinned-list',
      RegularListClass: 'scribble-regular-list',
      ItensListClass: 'scribble-posts-list',
      ItemClass: 'scribble-post-item',
      ItemTimelineClass: 'post-timeline',
      ItemContainerClass: 'post-container',
      ItemDeckClass: 'post-deck',
      ItemAvatarImageClass: 'post-author-avatar',
      ItemAvatarNameClass: 'post-author-name',
      ItemDeckTimeClass: 'post-deck-time',
      ItemContentClass: 'post-content'
    };

    // Set the option values to the values passed in to the function.
    for (var opt in Options) {
      if (Options.hasOwnProperty(opt)) {
        this.Options[opt] = Options[opt];
      }
    }

    // Default API hostame
    this.hostname = 'https://api.scribblelive.com/v1/';

    // Used to match the Dafault API hostname
    this.hostnameMatch = '^\https:\/\/api\.scribblelive\.com/v1/';

    // Controls pagination
    this.currentPage = 0;

    // Total pagination
    this.totalPages = 0;

    // Count added posts
    this.addedPosts = 0;

    // Is first render
    this.firstRender = true;

    // Count added posts in current page
    this.addedPostsCurrent = 0;

    // Save embeded tweets to avoid duplicated embeds.
    this.loadedTweets = [];

    // Set the last modified time variable (UTC Epoch Timestamp format).
    this.lastModifiedTime = '';

    // List containing all posts ids
    this.currentPostsList = [];

    // Get the current user device
    this.currentDevice = this.getCurrDevice();

    // Load external scripts
    this.loadExternalScripts();

    // Call the function that creates the element that the posts will be added to.
    this.createPostList();

    // Call the function that loads the most recent posts.
    this.getAllPosts();
  };

  // Get recent posts from the API
  ScribbleLiveFeed.prototype.drawNewPosts = function (pResponse) {
    this.drawPosts(pResponse, 'RECENT');
  };

  // Get older posts from the API
  ScribbleLiveFeed.prototype.drawOlderPosts = function (pResponse) {
    this.drawPosts(pResponse, 'OLDER');
  };

  // The function that decides what to do with the response it gets back from the api.
  ScribbleLiveFeed.prototype.drawPosts = function (pResponse, type) {
    var newPostsList = this.currentPostsList;
    var self = this;

    this.addedPostsCurrent = 0;
    this.totalPages = typeof pResponse.pagination !== 'undefined' ? pResponse.pagination.TotalPages : this.totalPages;

    // Update posts
    if (pResponse.posts !== undefined) {
      for (var p = 0; p < pResponse.posts.length; p++) {

        // If there are deleted posts, check if they are on the page, and deleted them if they are.
        if (pResponse.posts[p].IsDeleted) {
          this.deletePost(pResponse.posts[p].Id);

        // Edit / Add new posts.
        } else {
          if (this.currentPostsList.length !== 0 && this.shouldPostUpdate(pResponse.posts[p])) {
            this.editPost(pResponse.posts[p]);

          } else {
            this.buildPost(pResponse.posts[p], this.currentPostsList, type);
          }
        }
      }

      // Insert load more btn after first render.
      if (document.getElementById('scribble-load-more') === null) this.drawLoadMoreBtn();

      // Render Embeded Posts
      this.drawEmbeds();
    }

    // Load new posts rules
    if (type === 'RECENT') {

      // Get the time the event was last modified and format that time so it can be passed back to the ScribbleLive API.
      if (pResponse.posts.length > 0) {
        var lastPostTime = new Date(pResponse.posts[0].LastModifiedDate);
        this.lastModifiedTime = Math.round(lastPostTime.getTime() / 1000.0);
      }

      // Make the call to the API for updates (Pooling).
      var wait = setTimeout(function() { self.getNewPosts() }, this.Options.PoolingTime);

    // Load older posts rules
    } else if (type === 'OLDER') {
      var addedPosts = newPostsList.length - this.currentPostsList.length;

      newPostsList = this.getPostList();

      if (this.addedPosts === this.Options.PostsPerPage) {
        this.addedPosts = 0;
        this.loadingUpdate(false);
        return;
      }

      // If you do not get all predefined posts, do another get to complete.
      if ((this.currentPage <= this.totalPages) && (addedPosts < this.Options.PostsPerPage)) {
        this.currentPage++;
        this.getOlderPosts();
      }
    }

    this.firstRender = false;
  };

  // Configure the Embeds specific draw methods
  ScribbleLiveFeed.prototype.drawEmbeds = function () {
    if (this.Options.ShowTwitterTweets) {
      var tweets = document.getElementsByClassName('twitter-tweet');
      if (tweets.length > 0) this.drawTwitterTweets();
    }

    if (this.Options.ShowFacebookPosts) {
      var facePosts = document.getElementsByClassName('facebook-post');
      if (facePosts.length > 0) this.drawFacebookPosts();
    }
  };

  // Draw Twitter Embeds
  ScribbleLiveFeed.prototype.drawTwitterTweets = function () {
    if (typeof twttr !== 'undefined' && twttr !== null && typeof twttr.widgets !== 'undefined' && twttr.widgets !== null) {
      twttr.widgets.load();
    }
  };

  // Draw Facebook Posts
  ScribbleLiveFeed.prototype.drawFacebookPosts = function () {
    if (typeof FB !== 'undefined' && FB !== null && typeof FB.XFBML !== 'undefined' && FB.XFBML !== null) {
      FB.XFBML.parse();
    }
  };

  // Add the Load More Btn listener
  ScribbleLiveFeed.prototype.drawLoadMoreBtn = function () {
    var loadMoreParent = document.querySelector('#scribble-live-widget');
    var loadMoreBtn = document.createElement("button");
    var self = this;

    loadMoreBtn.id = 'scribble-load-more';
    loadMoreBtn.className = 'scribble-load-more';
    loadMoreBtn.innerHTML = 'Exibir Mais <i></i>';

    if(this.totalPages <= 1){ loadMoreBtn.disabled = true; }

    loadMoreParent.appendChild(loadMoreBtn);

    this.loadMoreBtn = document.getElementById('scribble-load-more');
    this.loadMoreBtn.addEventListener('click', function () {
      self.getOlderPosts();
    });
  };

  // The function that adds images, video, and audio to posts containing media that are added or edited.
  ScribbleLiveFeed.prototype.addMedia = function (pPost) {
    var Media = pPost.Media;
    var MediaHtml;

    if (pPost.Type === "IMAGE" && Media.Type === "IMAGE") {
      MediaHtml = "<img src='" + Media.Url + "'/>";
    }
    if (pPost.Type === "VIDEO" && Media.Type === "VIDEO") {
      MediaHtml = "<embed type='application/x-shockwave-flash' src='//embed.scribblelive.com/js/jwflvplayer/player-licensed.swf?ThreadId=" + this.Options.EventId + "' flashvars='file=" + Media.Url + "'>";
    }
    if (pPost.Type === "AUDIO" && Media.Type === "AUDIO") {
      MediaHtml = "<embed height='20' width='300' type='application/x-shockwave-flash' src='//embed.scribblelive.com/js/jwflvplayer/player-licensed.swf?ThreadId=" + this.Options.EventId + "' flashvars='file=" + Media.Url + "'>";
    }

    // Add the caption to the media added above.
    var newContent;
    if ((pPost.Content !== '') && (pPost.Content !== undefined) && (this.Options.ShowCaptions)) {
      var MediaCaption = "<p class='Caption'>" + pPost.Content + "</p>";
      newContent = MediaHtml + MediaCaption;
    } else {
      newContent = MediaHtml;
    }

    return newContent;
  };

  // The function that adds a post.
  ScribbleLiveFeed.prototype.buildPost = function (pPost, pPostList, type) {
    // A huge if statement that decides if it should be showing a post or not based on the options set when the widget is loaded.
    if (
      (pPost.Type === "IMAGE" && !this.Options.ShowImages) ||
      (pPost.Type === "VIDEO" && !this.Options.ShowVideos) ||
      (pPost.Type === "AUDIO" && !this.Options.ShowAudio) ||
      (pPost.IsStuck === 1 && !this.Options.ShowStuckPosts) ||
      (pPost.Type === "TEXT" && !this.Options.ShowTextPosts) ||
      (pPost.IsComment === 1 && !this.Options.ShowComments) ||
      (pPost.IsComment === 0 && !this.Options.ShowOfficialPosts) ||
      (pPost.Source.match("twitter") && !this.Options.ShowTwitterTweets) ||
      (!pPost.Source.match("twitter") && this.Options.ShowOnlyTweets) ||
      ((pPost.Source.match("mobile") || pPost.Source.match("SMS")) && !this.Options.ShowMobilePosts) ||
      (pPost.Source.match("www.facebook.com") && !this.Options.ShowFacebookPosts) ||
      (!pPost.Source.match("www.facebook.com") && this.Options.ShowOnlyFacebookPosts)
    ) {
      return;
    }

    // If the post you are trying to add is already on the page, stop trying to add it.
    for (var c = 0; c < pPostList.length; c++) {
      if (pPost.Id === parseInt(pPostList[c])) {
        return;
      }
    }

    // Create a new list item with the post id as the id attribute.
    var newListItem = document.createElement("li");
    newListItem.id = pPost.Id;
    newListItem.className = this.Options.ItemClass;
    if (pPost.Rank === 0) { newListItem.className += " pinned"; }

    // Create item timeline
    var newItemTimeline = document.createElement("time");
    newItemTimeline.className = this.Options.ItemTimelineClass;
    newItemTimeline.innerHTML = this.getTimeSince(new Date(pPost.LastModifiedDate));

    // Create item container
    var newItemContainer = document.createElement("div");
    newItemContainer.className = this.Options.ItemContainerClass;

    // Create item deck
    var newItemDeck = document.createElement("div");
    newItemDeck.className = this.Options.ItemDeckClass;

    // If there is an avatar associated with the creator of the post, create an image tag with the avatar url as the src attribute.
    var newItemAvatarImage;
    if (pPost.Creator.Avatar !== '' && this.Options.ShowAvatars) {
      newItemAvatarImage = document.createElement("img");
      newItemAvatarImage.src = pPost.Creator.Avatar;
      newItemAvatarImage.className = this.Options.ItemAvatarImageClass;
    }
    if (newItemAvatarImage !== undefined) {
      newItemDeck.appendChild(newItemAvatarImage);
    }

    // Create item author name. If the source is a social network, add a link to the social network account.
    var newItemAuthorName = document.createElement("div");
    newItemAuthorName.className = this.Options.ItemAvatarNameClass;
    newItemAuthorName.innerHTML = pPost.Creator.Name;
    newItemDeck.appendChild(newItemAuthorName);

    // Create item deck time
    var newItemDeckTime = document.createElement("div");
    newItemDeckTime.className = this.Options.ItemDeckTimeClass;
    newItemDeckTime.innerHTML = this.getTimeSince(new Date(pPost.LastModifiedDate));
    newItemDeck.appendChild(newItemDeckTime);

    // Create a div with a class of Content that contains the post content.
    var newContentDiv = document.createElement("div");
    newContentDiv.className = this.Options.ItemContentClass;

    // If the post is a facebook:post.
    if (pPost.PostMeta.Type === "facebook:post") {
      var facebookEmbed = pPost.Content;
      var facebookEmbedWidth = this.currentDevice === 'mobile' ? 'auto' : '540';
      facebookEmbed = facebookEmbed.replace('data-width="500"', 'data-width="' + facebookEmbedWidth + '"');
      newContentDiv.className += " facebook-post";
      newContentDiv.innerHTML = facebookEmbed;
    }

    // If the post is a twitter:tweet.
    else if (pPost.PostMeta.Type === "twitter:tweet") {
      var twitterEmbed = pPost.Content;
      newContentDiv.className += " twitter-tweet";
      newContentDiv.innerHTML = twitterEmbed;
    }

    // TO DO: If the post is a instagram:post.
    // else if (pPost.PostMeta.Type === "instagram:post") {
    //   newContentDiv.innerHTML = pPost.Content;
    // }

    else if (pPost.PostMeta.Type === "youtube:post") {
      var youtubeEmbed = pPost.Content;
      var youtubeEmbedHeigth = this.currentDevice === 'mobile' ? 'auto' : '420';
      youtubeEmbed = youtubeEmbed.replace('width="500" height="300"', 'width="100%" height="' + youtubeEmbedHeigth + '"');
      newContentDiv.className += " youtube-post";
      newContentDiv.innerHTML = youtubeEmbed;
    }

    else if (pPost.Media !== undefined) {
      newContentDiv.innerHTML = this.addMedia(pPost);
    }

    // Add any image, video, or audio to the post content div.
    else if (pPost.Media !== undefined) {
      newContentDiv.innerHTML = this.addMedia(pPost);
    }

    // Site preview
    else if (pPost.Content.indexOf('scrbbl-sitePreview') !== -1) {
      newContentDiv.className += " site-preview";
      newContentDiv.innerHTML = pPost.Content;
    }

    // Add the regular content.
    else {
      newContentDiv.innerHTML = pPost.Content;
    }

    // Add the item deck and item content to the item container div.
    newItemContainer.appendChild(newItemDeck);
    newItemContainer.appendChild(newContentDiv);

    // Add the timeline and the container div to the list item.
    newListItem.appendChild(newItemTimeline);
    newListItem.appendChild(newItemContainer);

    var pinnedList = document.getElementById(this.Options.PinnedListClass);
    var regularList = document.getElementById(this.Options.RegularListClass);

    // Rules for default new posts
    if (type === 'RECENT') {

      // Pinned Posts
      if (pPost.Rank === 0) {
        this.appendNode(newListItem, pinnedList, (this.firstRender ? 'bottom' : 'top'));

      // Regular Posts
      } else {
        this.appendNode(newListItem, regularList, (this.firstRender ? 'bottom' : 'top'));
      }

    // Rules for load-more older posts
    } else if (type === 'OLDER') {

      if (this.addedPosts < this.Options.PostsPerPage) {
        this.appendNode(newListItem, regularList, 'bottom');
        this.addedPosts++;
        this.addedPostsCurrent++;
      }

      // Only increments the page when all posts in the page have already been loaded
      if (this.addedPostsCurrent === this.Options.PostsPerPage) {
        this.currentPage++;
      }
    }
  };

  // The function that deletes a post.
  ScribbleLiveFeed.prototype.deletePost = function (pPostId) {
    var postToDelete = document.getElementById(pPostId);

    if (postToDelete !== null) {
      postToDelete.parentNode.removeChild(postToDelete);
    }

    this.currentPostsList = this.getPostList();
  };

  // The function that edits a post by finding the matching post id and replacing the Content div html.
  ScribbleLiveFeed.prototype.editPost = function (pPostToEdit) {
    var post = document.getElementById(pPostToEdit.Id);
    var postElements = post.getElementsByTagName("div");
    var self = this;

    for (var i = 0; i < postElements.length; i++) {
      if (postElements[i].className.indexOf(self.Options.ItemContentClass) !== -1) {
        if (pPostToEdit.Media !== undefined) {
          postElements[i].innerHTML = this.addMedia(pPostToEdit);
        } else {
          postElements[i].innerHTML = pPostToEdit.Content;
        }

        // Pin / Unpin posts
        if (pPostToEdit.Rank === 0 && post.parentElement.id === this.Options.RegularListClass) {
          this.pinPost(pPostToEdit);

        } else if(pPostToEdit.Rank === 1 && post.parentElement.id === this.Options.PinnedListClass) {
          this.unpinPost(pPostToEdit);
        }
      }
    }
  };

  // Pinn / Unpinn posts
  ScribbleLiveFeed.prototype.pinPost = function (pPostToPin) {
    this.deletePost(pPostToPin.Id);
    this.buildPost(pPostToPin, this.currentPostsList, 'RECENT');
  };

  // Pinn / Unpinn posts
  ScribbleLiveFeed.prototype.unpinPost = function (pPostToUnpin) {
    this.deletePost(pPostToUnpin.Id);
    this.buildPost(pPostToUnpin, this.currentPostsList, 'RECENT');
  };

  // Append itens in the dom tree
  ScribbleLiveFeed.prototype.appendNode = function (post, list, pos) {
    var position = (typeof pos === 'undefined') ? 'top' : pos;

    if (position === 'top') {
      list.insertBefore(post, list.firstChild);
    } else {
      list.appendChild(post);
    }

    this.currentPostsList = this.getPostList();
  };

  // If there are edited posts, edit them if they are on the page (compare ids) and haven't already been edited (compare last modified times).
  ScribbleLiveFeed.prototype.shouldPostUpdate = function (pPost) {
    var update = false;

    for (var b = 0; b < this.currentPostsList.length; b++) {
      var PostLastModified = Math.round(new Date(pPost.LastModifiedDate).getTime() / 1000.0);

      if (pPost.Id === parseInt(this.currentPostsList[b]) && PostLastModified > this.lastModifiedTime) {
        update = true;
      }
    }

    return update;
  };

  // Add an empty list to the element specified in the setup at the top of this script.
  ScribbleLiveFeed.prototype.createPostList = function () {
    var widgetDiv = document.createElement("div");
    widgetDiv.setAttribute("id", this.Options.WidgetClass);
    widgetDiv.className = this.Options.WidgetClass;

    var pinnedList = document.createElement("ul");
    pinnedList.setAttribute("id", this.Options.PinnedListClass);
    pinnedList.className = this.Options.PinnedListClass + " " + this.Options.ItensListClass;

    var regularList = document.createElement("ul");
    regularList.setAttribute("id", this.Options.RegularListClass);
    regularList.className = this.Options.RegularListClass + " " + this.Options.ItensListClass;

    widgetDiv.appendChild(pinnedList);
    widgetDiv.appendChild(regularList);

    document.getElementById(this.Options.WhereToAddPosts).appendChild(widgetDiv);
  };

  // Create a list of posts currently on the page by finding all list items inside the scribble-posts-list list and adding their ids to an array.
  ScribbleLiveFeed.prototype.getPostList = function () {
    var currentPostsList = [];
    var CurrentPosts = document.getElementById(this.Options.WidgetClass).getElementsByTagName("li");
    for (var j = 0; j < CurrentPosts.length; j++) {
      currentPostsList.push(CurrentPosts[j].getAttribute("id"));
    }
    return currentPostsList;
  };

  // The initial API call that gets all of the most recent posts and feeds them back into this script.
  ScribbleLiveFeed.prototype.getAllPosts = function () {
    var requestUrl = this.hostname + "stream/" + this.Options.EventId + "/posts?PageNumber=" + this.currentPage + "&PageSize=" + this.Options.PostsPerPage + "&Token=" + this.Options.APIToken;
    this.requestAPI('GET', requestUrl, this.drawNewPosts.bind(this));
  };

  // Get new posts.
  ScribbleLiveFeed.prototype.getNewPosts = function () {
    // var requestUrl = this.hostname + "stream/" + this.Options.EventId + "/posts/since?Timestamp=" + this.lastModifiedTime +"&Max=" + this.Options.PostsPerPage + "&IncludeStreamStatus=true&Token=" + this.Options.APIToken;
    var requestUrl = this.hostname + "stream/" + this.Options.EventId + "/posts/recent?Timestamp=" + this.lastModifiedTime + "&Token=" + this.Options.APIToken;
    console.log('[ScribbleLiveFeed] Pooling - Loading new posts ...');
    this.requestAPI('GET', requestUrl, this.drawNewPosts.bind(this));
  };

  // Paginate through the oldest posts
  ScribbleLiveFeed.prototype.getOlderPosts = function () {
    var requestUrl = this.hostname + "stream/" + this.Options.EventId + "/posts?PageNumber=" + this.currentPage + "&PageSize=" + this.Options.PostsPerPage + "&Token=" + this.Options.APIToken;
    this.loadingUpdate(true);
    this.requestAPI('GET', requestUrl, this.drawOlderPosts.bind(this));
  };

  // Generic AJAX Method
  ScribbleLiveFeed.prototype.requestAPI = function (method, url, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function () {
      if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
        callback(JSON.parse(xmlhttp.responseText));
      }
    };
    xmlhttp.onerror = function (e) {
      console.log('[Scribble] Error', e);
    };
    xmlhttp.open(method, url, true);
    xmlhttp.send();
  };

  // Call all specific load methods
  ScribbleLiveFeed.prototype.loadExternalScripts = function () {
    if (this.Options.ShowTwitterTweets) this.loadTwitterScripts();
    if (this.Options.ShowFacebookPosts) this.loadFacebookScripts();

    this.loadScribbleScripts();
  };

  // Load Scribble scripts
  ScribbleLiveFeed.prototype.loadScribbleScripts = function () {
    (function (w, d, eid, self) {
      var id = 'sl-libjs',
        where = d.getElementsByTagName('script')[0];

      if (d.getElementById(id)) return;

      w._slq = w._slq || [];
      _slq.push(['_setEventId', eid]);

      js = d.createElement('script');
      js.id = id;
      js.async = true;
      js.src = '//embed.scribblelive.com/modules/lib/addons.js';
      where.parentNode.insertBefore(js, where);
    }(window, document, this.Options.EventId, this));
  };

  // Load Twitter scripts
  ScribbleLiveFeed.prototype.loadTwitterScripts = function () {
    window.twttr = (function (d, s, id, self) {
      var js, fjs = d.getElementsByTagName(s)[0],
        t = window.twttr || {};
      if (d.getElementById(id)) return t;
      js = d.createElement(s);
      js.id = id;
      js.src = "https://platform.twitter.com/widgets.js";
      fjs.parentNode.insertBefore(js, fjs);
      t._e = [];
      t.ready = function (f) {
        t._e.push(f);
      };
      return t;
    }(document, "script", "twitter-wjs", this));
  };

  // Load Facebook scripts
  ScribbleLiveFeed.prototype.loadFacebookScripts = function () {
    var fbRoot = document.createElement("div");
    fbRoot.id = "fb-root";
    document.querySelector('body').appendChild(fbRoot);
    (function (d, s, id, self) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s);
      js.id = id;
      js.src = "//connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.7";
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk', this));
  };

  // Update LoadMore Btn state
  ScribbleLiveFeed.prototype.loadingUpdate = function (loading) {
    if (this.currentPage <= this.totalPages) {
      if (loading) {
        this.loadMoreBtn.innerHTML = '<svg width="52px" height="52px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" class="uil-ring-alt" style=" height: 30px;"><rect x="0" y="0" width="100" height="100" fill="none" class="bk"></rect><circle cx="50" cy="50" r="40" stroke="#d0d0d0" fill="none" stroke-width="10" stroke-linecap="round"></circle><circle cx="50" cy="50" r="40" stroke="#555555" fill="none" stroke-width="6" stroke-linecap="round"><animate attributeName="stroke-dashoffset" dur="2s" repeatCount="indefinite" from="0" to="502"></animate><animate attributeName="stroke-dasharray" dur="2s" repeatCount="indefinite" values="175.7 75.30000000000001;1 250;175.7 75.30000000000001"></animate></circle></svg>';
      } else {
        this.loadMoreBtn.innerHTML = "Exibir Mais <i></i>";
      }

      this.loadMoreBtn.disabled = false;

    } else {
      this.loadMoreBtn.innerHTML = "Exibir Mais <i></i>";
      this.loadMoreBtn.disabled = true;
    }
  };

  // Generic Time-Since function
  ScribbleLiveFeed.prototype.getTimeSince = function (previous) {
    var msPerMinute = 60 * 1000,
      msPerHour = msPerMinute * 60,
      msPerDay = msPerHour * 24,
      msPerMonth = msPerDay * 30,
      msPerYear = msPerDay * 365,
      current = new Date(),
      since = current - previous;

    if (since < msPerMinute) {
      return 'Há ' + Math.round(since / 1000) + ' seg';
    } else if (since < msPerHour) {
      return 'Há ' + Math.round(since / msPerMinute) + ' min';
    } else if (since < msPerDay) {
      if (Math.round(since / msPerHour) === 1) return 'Há ' + Math.round(since / msPerHour) + ' hora';
      return 'Há ' + Math.round(since / msPerHour) + ' horas';
    } else if (since < msPerMonth) {
      if (Math.round(since / msPerDay) === 1) return 'Há ' + Math.round(since / msPerDay) + ' dia';
      return 'Há ' + Math.round(since / msPerDay) + ' dias';
    } else if (since < msPerYear) {
      if (Math.round(since / msPerMonth) === 1) return 'Há ' + Math.round(since / msPerMonth) + ' mês';
      return 'Há ' + Math.round(since / msPerMonth) + ' meses';
    } else {
      if (Math.round(since / msPerYear) === 1) return 'Há ' + Math.round(since / msPerYear) + ' ano';
      return 'Há ' + Math.round(since / msPerYear) + ' anos';
    }
  };

  // Generic function to get Current Device
  ScribbleLiveFeed.prototype.getCurrDevice = function () {
    var w = window.innerWidth || window.clientWidth || window.clientWidth;
    return (w <= 768) ? 'mobile' : (w <= 1024) ? 'tablet' : 'desktop';
  };

  return ScribbleLiveFeed;

})));

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNjcmliYmxlbGl2ZWZlZWQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJzY3JpYmJsZWxpdmVmZWVkLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLypcblxuVGl0bGU6IFNjcmliYmxlTGl2ZSBGZWVkXG5EZXNjcmlwdGlvbjogVGhlIFNjcmliYmxlIExpdmUgRmVlZCBXaWRnZXQsIGNyZWF0ZSBhIG5ld3MgZmVlZCB3aXRoIHRoZSBtb3N0IHJlY2VudCBwb3N0cyBpbiB5b3VyIFNjcmliYmxlTGl2ZSBTdHJlYW0uIFRoaXMgcHJvamVjdCBpcyBhIGZvcmsgb2YgdGhlIHJlY2VudC1wb3N0cyB3aWRnZXQgYnkgTWF0dCBNY2NhdXNsYW5kLlxuQXV0aG9yOiBSYWZhZWwgUnVtcGVsXG5HaXRodWI6IGh0dHBzOi8vZ2l0aHViLmNvbS9SYWZhZWxSdW1wZWwvc2NyaWJibGVsaXZlZmVlZFxuXG4qL1xuXG47KGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcbiAgICB0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKSA6XG4gICAgdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKGZhY3RvcnkpIDpcbiAgICBnbG9iYWwuc2NyaWJibGVsaXZlZmVlZCA9IGZhY3RvcnkoKVxufSh0aGlzLCAoZnVuY3Rpb24gKCkge1xuXG4gIHZhciBTY3JpYmJsZUxpdmVGZWVkID0gZnVuY3Rpb24gKE9wdGlvbnMpIHtcblxuICAgIHRoaXMudmVyc2lvbiA9ICcyLjEuMic7XG5cbiAgICB0aGlzLk9wdGlvbnMgPSB7XG4gICAgICAvLyBZb3UgY2FuIGZpbmQgeW91ciBBUEkgdG9rZW5zIC0gYW5kIGdlbmVyYXRlIG5ldyBvbmVzIC0gdW5kZXIgdGhlIGdlbmVyYWwgQVBJIHNlY3Rpb24gb2YgeW91ciBTY3JpYmJsZUxpdmUgYmFjayBlbmQuIGh0dHBzOi8vY2xpZW50LnNjcmliYmxlbGl2ZS5jb20vY2xpZW50L0FQSS5hc3B4XG4gICAgICBBUElUb2tlbjogJycsXG4gICAgICAvLyBZb3UgY2FuIGZpbmQgeW91ciBldmVudCBpZCB1bmRlciB0aGUgQVBJIHNlY3Rpb24gb2YgeW91ciBldmVudCBpbiB0aGUgU2NyaWJibGVMaXZlIGJhY2sgZW5kLiBZb3UgY2FuIGFsc28gdmlldyBzb3VyY2Ugb24geW91ciBldmVudCBhbmQgc2VhcmNoIGZvciBcIlRocmVhZElkXCIuXG4gICAgICBFdmVudElkOiAnJyxcbiAgICAgIC8vIFRoZSBudW1iZXIgb2YgcG9zdHMgeW91IHdvdWxkIGxpa2UgdG8gZGlzcGxheS5cbiAgICAgIFBvc3RzUGVyUGFnZTogMTAsXG4gICAgICAvLyBUaGUgaWQgb2YgdGhlIGVsZW1lbnQgb24geW91ciBwYWdlIHdoZXJlIHlvdSB3b3VsZCBsaWtlIHRvIGRpc3BsYXkgdGhlIHBvc3RzLlxuICAgICAgV2hlcmVUb0FkZFBvc3RzOiAnJyxcbiAgICAgIC8vIFRoZSBudW1iZXIgb2Ygc2Vjb25kcyB5b3Ugd2FudCB0byBjaGVjayBmb3IgbmV3IHN0cmVhbXNcbiAgICAgIFBvb2xpbmdUaW1lOiAzMTAwMCxcbiAgICAgIC8vIFBvb2xpbmdUaW1lOiA1MDAwLCAvL2RlYnVnIG9ubHlcbiAgICAgIC8vIFNob3cgaW1hZ2VzLCB0cnVlIG9yIGZhbHNlLlxuICAgICAgU2hvd0ltYWdlczogdHJ1ZSxcbiAgICAgIC8vIFNob3cgdmlkZW9zLCB0cnVlIG9yIGZhbHNlLlxuICAgICAgU2hvd1ZpZGVvczogdHJ1ZSxcbiAgICAgIC8vIFNob3cgYXVkaW8sIHRydWUgb3IgZmFsc2UuXG4gICAgICBTaG93QXVkaW86IHRydWUsXG4gICAgICAvLyBTaG93IHN0dWNrIHBvc3RzLCB0cnVlIG9yIGZhbHNlLlxuICAgICAgU2hvd1N0dWNrUG9zdHM6IHRydWUsXG4gICAgICAvLyBTaG93IGF2YXRhcnMsIHRydWUgb3IgZmFsc2UuXG4gICAgICBTaG93QXZhdGFyczogdHJ1ZSxcbiAgICAgIC8vIFNob3cgdGV4dCBwb3N0cywgdHJ1ZSBvciBmYWxzZS5cbiAgICAgIFNob3dUZXh0UG9zdHM6IHRydWUsXG4gICAgICAvLyBTaG93IG1lZGlhIGNhcHRpb25zLCB0cnVlIG9yIGZhbHNlLlxuICAgICAgU2hvd0NhcHRpb25zOiB0cnVlLFxuICAgICAgLy8gU2hvdyBjb21tZW50cywgdHJ1ZSBvciBmYWxzZS5cbiAgICAgIFNob3dDb21tZW50czogdHJ1ZSxcbiAgICAgIC8vIFNob3cgb2ZmaWNpYWwgKHdyaXRlciwgZWRpdG9yLCBtb2RlcmF0b3IsIGFkbWluaXN0cmF0b3IsIGd1ZXN0IHdyaXRlciwgZXRjLikgcG9zdHMsIHRydWUgb3IgZmFsc2UuXG4gICAgICBTaG93T2ZmaWNpYWxQb3N0czogdHJ1ZSxcbiAgICAgIC8vIFNob3cgVHdpdHRlciBwb3N0cywgdHJ1ZSBvciBmYWxzZS5cbiAgICAgIFNob3dUd2l0dGVyVHdlZXRzOiB0cnVlLFxuICAgICAgLy8gU2hvdyBtb2JpbGUgcG9zdHMsIHRydWUgb2YgZmFsc2UuXG4gICAgICBTaG93TW9iaWxlUG9zdHM6IHRydWUsXG4gICAgICAvLyBTaG93IEZhY2Vib29rIHBvc3RzLCB0cnVlIG9yIGZhbHNlLlxuICAgICAgU2hvd0ZhY2Vib29rUG9zdHM6IHRydWUsXG4gICAgICAvLyBTaG93IG9ubHkgVHdpdHRlciBwb3N0cywgdHJ1ZSBvciBmYWxzZS5cbiAgICAgIFNob3dPbmx5VHdlZXRzOiBmYWxzZSxcbiAgICAgIC8vIFNob3cgb25seSBGYWNlYm9vayBwb3N0cywgdHJ1ZSBvciBmYWxzZS5cbiAgICAgIFNob3dPbmx5RmFjZWJvb2tQb3N0czogZmFsc2UsXG4gICAgICAvLyBDU1MgY2xhc3Nlc1xuICAgICAgV2lkZ2V0Q2xhc3M6ICdzY3JpYmJsZS1wb3N0cy13cmFwcGVyJyxcbiAgICAgIFBpbm5lZExpc3RDbGFzczogJ3NjcmliYmxlLXBpbm5lZC1saXN0JyxcbiAgICAgIFJlZ3VsYXJMaXN0Q2xhc3M6ICdzY3JpYmJsZS1yZWd1bGFyLWxpc3QnLFxuICAgICAgSXRlbnNMaXN0Q2xhc3M6ICdzY3JpYmJsZS1wb3N0cy1saXN0JyxcbiAgICAgIEl0ZW1DbGFzczogJ3NjcmliYmxlLXBvc3QtaXRlbScsXG4gICAgICBJdGVtVGltZWxpbmVDbGFzczogJ3Bvc3QtdGltZWxpbmUnLFxuICAgICAgSXRlbUNvbnRhaW5lckNsYXNzOiAncG9zdC1jb250YWluZXInLFxuICAgICAgSXRlbURlY2tDbGFzczogJ3Bvc3QtZGVjaycsXG4gICAgICBJdGVtQXZhdGFySW1hZ2VDbGFzczogJ3Bvc3QtYXV0aG9yLWF2YXRhcicsXG4gICAgICBJdGVtQXZhdGFyTmFtZUNsYXNzOiAncG9zdC1hdXRob3ItbmFtZScsXG4gICAgICBJdGVtRGVja1RpbWVDbGFzczogJ3Bvc3QtZGVjay10aW1lJyxcbiAgICAgIEl0ZW1Db250ZW50Q2xhc3M6ICdwb3N0LWNvbnRlbnQnXG4gICAgfTtcblxuICAgIC8vIFNldCB0aGUgb3B0aW9uIHZhbHVlcyB0byB0aGUgdmFsdWVzIHBhc3NlZCBpbiB0byB0aGUgZnVuY3Rpb24uXG4gICAgZm9yICh2YXIgb3B0IGluIE9wdGlvbnMpIHtcbiAgICAgIGlmIChPcHRpb25zLmhhc093blByb3BlcnR5KG9wdCkpIHtcbiAgICAgICAgdGhpcy5PcHRpb25zW29wdF0gPSBPcHRpb25zW29wdF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRGVmYXVsdCBBUEkgaG9zdGFtZVxuICAgIHRoaXMuaG9zdG5hbWUgPSAnaHR0cHM6Ly9hcGkuc2NyaWJibGVsaXZlLmNvbS92MS8nO1xuXG4gICAgLy8gVXNlZCB0byBtYXRjaCB0aGUgRGFmYXVsdCBBUEkgaG9zdG5hbWVcbiAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSAnXlxcaHR0cHM6XFwvXFwvYXBpXFwuc2NyaWJibGVsaXZlXFwuY29tL3YxLyc7XG5cbiAgICAvLyBDb250cm9scyBwYWdpbmF0aW9uXG4gICAgdGhpcy5jdXJyZW50UGFnZSA9IDA7XG5cbiAgICAvLyBUb3RhbCBwYWdpbmF0aW9uXG4gICAgdGhpcy50b3RhbFBhZ2VzID0gMDtcblxuICAgIC8vIENvdW50IGFkZGVkIHBvc3RzXG4gICAgdGhpcy5hZGRlZFBvc3RzID0gMDtcblxuICAgIC8vIElzIGZpcnN0IHJlbmRlclxuICAgIHRoaXMuZmlyc3RSZW5kZXIgPSB0cnVlO1xuXG4gICAgLy8gQ291bnQgYWRkZWQgcG9zdHMgaW4gY3VycmVudCBwYWdlXG4gICAgdGhpcy5hZGRlZFBvc3RzQ3VycmVudCA9IDA7XG5cbiAgICAvLyBTYXZlIGVtYmVkZWQgdHdlZXRzIHRvIGF2b2lkIGR1cGxpY2F0ZWQgZW1iZWRzLlxuICAgIHRoaXMubG9hZGVkVHdlZXRzID0gW107XG5cbiAgICAvLyBTZXQgdGhlIGxhc3QgbW9kaWZpZWQgdGltZSB2YXJpYWJsZSAoVVRDIEVwb2NoIFRpbWVzdGFtcCBmb3JtYXQpLlxuICAgIHRoaXMubGFzdE1vZGlmaWVkVGltZSA9ICcnO1xuXG4gICAgLy8gTGlzdCBjb250YWluaW5nIGFsbCBwb3N0cyBpZHNcbiAgICB0aGlzLmN1cnJlbnRQb3N0c0xpc3QgPSBbXTtcblxuICAgIC8vIEdldCB0aGUgY3VycmVudCB1c2VyIGRldmljZVxuICAgIHRoaXMuY3VycmVudERldmljZSA9IHRoaXMuZ2V0Q3VyckRldmljZSgpO1xuXG4gICAgLy8gTG9hZCBleHRlcm5hbCBzY3JpcHRzXG4gICAgdGhpcy5sb2FkRXh0ZXJuYWxTY3JpcHRzKCk7XG5cbiAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgdGhlIGVsZW1lbnQgdGhhdCB0aGUgcG9zdHMgd2lsbCBiZSBhZGRlZCB0by5cbiAgICB0aGlzLmNyZWF0ZVBvc3RMaXN0KCk7XG5cbiAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiB0aGF0IGxvYWRzIHRoZSBtb3N0IHJlY2VudCBwb3N0cy5cbiAgICB0aGlzLmdldEFsbFBvc3RzKCk7XG4gIH07XG5cbiAgLy8gR2V0IHJlY2VudCBwb3N0cyBmcm9tIHRoZSBBUElcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZHJhd05ld1Bvc3RzID0gZnVuY3Rpb24gKHBSZXNwb25zZSkge1xuICAgIHRoaXMuZHJhd1Bvc3RzKHBSZXNwb25zZSwgJ1JFQ0VOVCcpO1xuICB9O1xuXG4gIC8vIEdldCBvbGRlciBwb3N0cyBmcm9tIHRoZSBBUElcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZHJhd09sZGVyUG9zdHMgPSBmdW5jdGlvbiAocFJlc3BvbnNlKSB7XG4gICAgdGhpcy5kcmF3UG9zdHMocFJlc3BvbnNlLCAnT0xERVInKTtcbiAgfTtcblxuICAvLyBUaGUgZnVuY3Rpb24gdGhhdCBkZWNpZGVzIHdoYXQgdG8gZG8gd2l0aCB0aGUgcmVzcG9uc2UgaXQgZ2V0cyBiYWNrIGZyb20gdGhlIGFwaS5cbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZHJhd1Bvc3RzID0gZnVuY3Rpb24gKHBSZXNwb25zZSwgdHlwZSkge1xuICAgIHZhciBuZXdQb3N0c0xpc3QgPSB0aGlzLmN1cnJlbnRQb3N0c0xpc3Q7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdGhpcy5hZGRlZFBvc3RzQ3VycmVudCA9IDA7XG4gICAgdGhpcy50b3RhbFBhZ2VzID0gdHlwZW9mIHBSZXNwb25zZS5wYWdpbmF0aW9uICE9PSAndW5kZWZpbmVkJyA/IHBSZXNwb25zZS5wYWdpbmF0aW9uLlRvdGFsUGFnZXMgOiB0aGlzLnRvdGFsUGFnZXM7XG5cbiAgICAvLyBVcGRhdGUgcG9zdHNcbiAgICBpZiAocFJlc3BvbnNlLnBvc3RzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGZvciAodmFyIHAgPSAwOyBwIDwgcFJlc3BvbnNlLnBvc3RzLmxlbmd0aDsgcCsrKSB7XG5cbiAgICAgICAgLy8gSWYgdGhlcmUgYXJlIGRlbGV0ZWQgcG9zdHMsIGNoZWNrIGlmIHRoZXkgYXJlIG9uIHRoZSBwYWdlLCBhbmQgZGVsZXRlZCB0aGVtIGlmIHRoZXkgYXJlLlxuICAgICAgICBpZiAocFJlc3BvbnNlLnBvc3RzW3BdLklzRGVsZXRlZCkge1xuICAgICAgICAgIHRoaXMuZGVsZXRlUG9zdChwUmVzcG9uc2UucG9zdHNbcF0uSWQpO1xuXG4gICAgICAgIC8vIEVkaXQgLyBBZGQgbmV3IHBvc3RzLlxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnRQb3N0c0xpc3QubGVuZ3RoICE9PSAwICYmIHRoaXMuc2hvdWxkUG9zdFVwZGF0ZShwUmVzcG9uc2UucG9zdHNbcF0pKSB7XG4gICAgICAgICAgICB0aGlzLmVkaXRQb3N0KHBSZXNwb25zZS5wb3N0c1twXSk7XG5cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5idWlsZFBvc3QocFJlc3BvbnNlLnBvc3RzW3BdLCB0aGlzLmN1cnJlbnRQb3N0c0xpc3QsIHR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBJbnNlcnQgbG9hZCBtb3JlIGJ0biBhZnRlciBmaXJzdCByZW5kZXIuXG4gICAgICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjcmliYmxlLWxvYWQtbW9yZScpID09PSBudWxsKSB0aGlzLmRyYXdMb2FkTW9yZUJ0bigpO1xuXG4gICAgICAvLyBSZW5kZXIgRW1iZWRlZCBQb3N0c1xuICAgICAgdGhpcy5kcmF3RW1iZWRzKCk7XG4gICAgfVxuXG4gICAgLy8gTG9hZCBuZXcgcG9zdHMgcnVsZXNcbiAgICBpZiAodHlwZSA9PT0gJ1JFQ0VOVCcpIHtcblxuICAgICAgLy8gR2V0IHRoZSB0aW1lIHRoZSBldmVudCB3YXMgbGFzdCBtb2RpZmllZCBhbmQgZm9ybWF0IHRoYXQgdGltZSBzbyBpdCBjYW4gYmUgcGFzc2VkIGJhY2sgdG8gdGhlIFNjcmliYmxlTGl2ZSBBUEkuXG4gICAgICBpZiAocFJlc3BvbnNlLnBvc3RzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdmFyIGxhc3RQb3N0VGltZSA9IG5ldyBEYXRlKHBSZXNwb25zZS5wb3N0c1swXS5MYXN0TW9kaWZpZWREYXRlKTtcbiAgICAgICAgdGhpcy5sYXN0TW9kaWZpZWRUaW1lID0gTWF0aC5yb3VuZChsYXN0UG9zdFRpbWUuZ2V0VGltZSgpIC8gMTAwMC4wKTtcbiAgICAgIH1cblxuICAgICAgLy8gTWFrZSB0aGUgY2FsbCB0byB0aGUgQVBJIGZvciB1cGRhdGVzIChQb29saW5nKS5cbiAgICAgIHZhciB3YWl0ID0gc2V0VGltZW91dChmdW5jdGlvbigpIHsgc2VsZi5nZXROZXdQb3N0cygpIH0sIHRoaXMuT3B0aW9ucy5Qb29saW5nVGltZSk7XG5cbiAgICAvLyBMb2FkIG9sZGVyIHBvc3RzIHJ1bGVzXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnT0xERVInKSB7XG4gICAgICB2YXIgYWRkZWRQb3N0cyA9IG5ld1Bvc3RzTGlzdC5sZW5ndGggLSB0aGlzLmN1cnJlbnRQb3N0c0xpc3QubGVuZ3RoO1xuXG4gICAgICBuZXdQb3N0c0xpc3QgPSB0aGlzLmdldFBvc3RMaXN0KCk7XG5cbiAgICAgIGlmICh0aGlzLmFkZGVkUG9zdHMgPT09IHRoaXMuT3B0aW9ucy5Qb3N0c1BlclBhZ2UpIHtcbiAgICAgICAgdGhpcy5hZGRlZFBvc3RzID0gMDtcbiAgICAgICAgdGhpcy5sb2FkaW5nVXBkYXRlKGZhbHNlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB5b3UgZG8gbm90IGdldCBhbGwgcHJlZGVmaW5lZCBwb3N0cywgZG8gYW5vdGhlciBnZXQgdG8gY29tcGxldGUuXG4gICAgICBpZiAoKHRoaXMuY3VycmVudFBhZ2UgPD0gdGhpcy50b3RhbFBhZ2VzKSAmJiAoYWRkZWRQb3N0cyA8IHRoaXMuT3B0aW9ucy5Qb3N0c1BlclBhZ2UpKSB7XG4gICAgICAgIHRoaXMuY3VycmVudFBhZ2UrKztcbiAgICAgICAgdGhpcy5nZXRPbGRlclBvc3RzKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5maXJzdFJlbmRlciA9IGZhbHNlO1xuICB9O1xuXG4gIC8vIENvbmZpZ3VyZSB0aGUgRW1iZWRzIHNwZWNpZmljIGRyYXcgbWV0aG9kc1xuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5kcmF3RW1iZWRzID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLk9wdGlvbnMuU2hvd1R3aXR0ZXJUd2VldHMpIHtcbiAgICAgIHZhciB0d2VldHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCd0d2l0dGVyLXR3ZWV0Jyk7XG4gICAgICBpZiAodHdlZXRzLmxlbmd0aCA+IDApIHRoaXMuZHJhd1R3aXR0ZXJUd2VldHMoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5PcHRpb25zLlNob3dGYWNlYm9va1Bvc3RzKSB7XG4gICAgICB2YXIgZmFjZVBvc3RzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnZmFjZWJvb2stcG9zdCcpO1xuICAgICAgaWYgKGZhY2VQb3N0cy5sZW5ndGggPiAwKSB0aGlzLmRyYXdGYWNlYm9va1Bvc3RzKCk7XG4gICAgfVxuICB9O1xuXG4gIC8vIERyYXcgVHdpdHRlciBFbWJlZHNcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZHJhd1R3aXR0ZXJUd2VldHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHR5cGVvZiB0d3R0ciAhPT0gJ3VuZGVmaW5lZCcgJiYgdHd0dHIgIT09IG51bGwgJiYgdHlwZW9mIHR3dHRyLndpZGdldHMgIT09ICd1bmRlZmluZWQnICYmIHR3dHRyLndpZGdldHMgIT09IG51bGwpIHtcbiAgICAgIHR3dHRyLndpZGdldHMubG9hZCgpO1xuICAgIH1cbiAgfTtcblxuICAvLyBEcmF3IEZhY2Vib29rIFBvc3RzXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLmRyYXdGYWNlYm9va1Bvc3RzID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0eXBlb2YgRkIgIT09ICd1bmRlZmluZWQnICYmIEZCICE9PSBudWxsICYmIHR5cGVvZiBGQi5YRkJNTCAhPT0gJ3VuZGVmaW5lZCcgJiYgRkIuWEZCTUwgIT09IG51bGwpIHtcbiAgICAgIEZCLlhGQk1MLnBhcnNlKCk7XG4gICAgfVxuICB9O1xuXG4gIC8vIEFkZCB0aGUgTG9hZCBNb3JlIEJ0biBsaXN0ZW5lclxuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5kcmF3TG9hZE1vcmVCdG4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxvYWRNb3JlUGFyZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3NjcmliYmxlLWxpdmUtd2lkZ2V0Jyk7XG4gICAgdmFyIGxvYWRNb3JlQnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBsb2FkTW9yZUJ0bi5pZCA9ICdzY3JpYmJsZS1sb2FkLW1vcmUnO1xuICAgIGxvYWRNb3JlQnRuLmNsYXNzTmFtZSA9ICdzY3JpYmJsZS1sb2FkLW1vcmUnO1xuICAgIGxvYWRNb3JlQnRuLmlubmVySFRNTCA9ICdFeGliaXIgTWFpcyA8aT48L2k+JztcblxuICAgIGlmKHRoaXMudG90YWxQYWdlcyA8PSAxKXsgbG9hZE1vcmVCdG4uZGlzYWJsZWQgPSB0cnVlOyB9XG5cbiAgICBsb2FkTW9yZVBhcmVudC5hcHBlbmRDaGlsZChsb2FkTW9yZUJ0bik7XG5cbiAgICB0aGlzLmxvYWRNb3JlQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjcmliYmxlLWxvYWQtbW9yZScpO1xuICAgIHRoaXMubG9hZE1vcmVCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLmdldE9sZGVyUG9zdHMoKTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBUaGUgZnVuY3Rpb24gdGhhdCBhZGRzIGltYWdlcywgdmlkZW8sIGFuZCBhdWRpbyB0byBwb3N0cyBjb250YWluaW5nIG1lZGlhIHRoYXQgYXJlIGFkZGVkIG9yIGVkaXRlZC5cbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuYWRkTWVkaWEgPSBmdW5jdGlvbiAocFBvc3QpIHtcbiAgICB2YXIgTWVkaWEgPSBwUG9zdC5NZWRpYTtcbiAgICB2YXIgTWVkaWFIdG1sO1xuXG4gICAgaWYgKHBQb3N0LlR5cGUgPT09IFwiSU1BR0VcIiAmJiBNZWRpYS5UeXBlID09PSBcIklNQUdFXCIpIHtcbiAgICAgIE1lZGlhSHRtbCA9IFwiPGltZyBzcmM9J1wiICsgTWVkaWEuVXJsICsgXCInLz5cIjtcbiAgICB9XG4gICAgaWYgKHBQb3N0LlR5cGUgPT09IFwiVklERU9cIiAmJiBNZWRpYS5UeXBlID09PSBcIlZJREVPXCIpIHtcbiAgICAgIE1lZGlhSHRtbCA9IFwiPGVtYmVkIHR5cGU9J2FwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoJyBzcmM9J2h0dHA6Ly9lbWJlZC5zY3JpYmJsZWxpdmUuY29tL2pzL2p3Zmx2cGxheWVyL3BsYXllci1saWNlbnNlZC5zd2Y/VGhyZWFkSWQ9XCIgKyB0aGlzLk9wdGlvbnMuRXZlbnRJZCArIFwiJyBmbGFzaHZhcnM9J2ZpbGU9XCIgKyBNZWRpYS5VcmwgKyBcIic+XCI7XG4gICAgfVxuICAgIGlmIChwUG9zdC5UeXBlID09PSBcIkFVRElPXCIgJiYgTWVkaWEuVHlwZSA9PT0gXCJBVURJT1wiKSB7XG4gICAgICBNZWRpYUh0bWwgPSBcIjxlbWJlZCBoZWlnaHQ9JzIwJyB3aWR0aD0nMzAwJyB0eXBlPSdhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaCcgc3JjPSdodHRwOi8vZW1iZWQuc2NyaWJibGVsaXZlLmNvbS9qcy9qd2ZsdnBsYXllci9wbGF5ZXItbGljZW5zZWQuc3dmP1RocmVhZElkPVwiICsgdGhpcy5PcHRpb25zLkV2ZW50SWQgKyBcIicgZmxhc2h2YXJzPSdmaWxlPVwiICsgTWVkaWEuVXJsICsgXCInPlwiO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgY2FwdGlvbiB0byB0aGUgbWVkaWEgYWRkZWQgYWJvdmUuXG4gICAgdmFyIG5ld0NvbnRlbnQ7XG4gICAgaWYgKChwUG9zdC5Db250ZW50ICE9PSAnJykgJiYgKHBQb3N0LkNvbnRlbnQgIT09IHVuZGVmaW5lZCkgJiYgKHRoaXMuT3B0aW9ucy5TaG93Q2FwdGlvbnMpKSB7XG4gICAgICB2YXIgTWVkaWFDYXB0aW9uID0gXCI8cCBjbGFzcz0nQ2FwdGlvbic+XCIgKyBwUG9zdC5Db250ZW50ICsgXCI8L3A+XCI7XG4gICAgICBuZXdDb250ZW50ID0gTWVkaWFIdG1sICsgTWVkaWFDYXB0aW9uO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXdDb250ZW50ID0gTWVkaWFIdG1sO1xuICAgIH1cblxuICAgIHJldHVybiBuZXdDb250ZW50O1xuICB9O1xuXG4gIC8vIFRoZSBmdW5jdGlvbiB0aGF0IGFkZHMgYSBwb3N0LlxuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5idWlsZFBvc3QgPSBmdW5jdGlvbiAocFBvc3QsIHBQb3N0TGlzdCwgdHlwZSkge1xuICAgIC8vIEEgaHVnZSBpZiBzdGF0ZW1lbnQgdGhhdCBkZWNpZGVzIGlmIGl0IHNob3VsZCBiZSBzaG93aW5nIGEgcG9zdCBvciBub3QgYmFzZWQgb24gdGhlIG9wdGlvbnMgc2V0IHdoZW4gdGhlIHdpZGdldCBpcyBsb2FkZWQuXG4gICAgaWYgKFxuICAgICAgKHBQb3N0LlR5cGUgPT09IFwiSU1BR0VcIiAmJiAhdGhpcy5PcHRpb25zLlNob3dJbWFnZXMpIHx8XG4gICAgICAocFBvc3QuVHlwZSA9PT0gXCJWSURFT1wiICYmICF0aGlzLk9wdGlvbnMuU2hvd1ZpZGVvcykgfHxcbiAgICAgIChwUG9zdC5UeXBlID09PSBcIkFVRElPXCIgJiYgIXRoaXMuT3B0aW9ucy5TaG93QXVkaW8pIHx8XG4gICAgICAocFBvc3QuSXNTdHVjayA9PT0gMSAmJiAhdGhpcy5PcHRpb25zLlNob3dTdHVja1Bvc3RzKSB8fFxuICAgICAgKHBQb3N0LlR5cGUgPT09IFwiVEVYVFwiICYmICF0aGlzLk9wdGlvbnMuU2hvd1RleHRQb3N0cykgfHxcbiAgICAgIChwUG9zdC5Jc0NvbW1lbnQgPT09IDEgJiYgIXRoaXMuT3B0aW9ucy5TaG93Q29tbWVudHMpIHx8XG4gICAgICAocFBvc3QuSXNDb21tZW50ID09PSAwICYmICF0aGlzLk9wdGlvbnMuU2hvd09mZmljaWFsUG9zdHMpIHx8XG4gICAgICAocFBvc3QuU291cmNlLm1hdGNoKFwidHdpdHRlclwiKSAmJiAhdGhpcy5PcHRpb25zLlNob3dUd2l0dGVyVHdlZXRzKSB8fFxuICAgICAgKCFwUG9zdC5Tb3VyY2UubWF0Y2goXCJ0d2l0dGVyXCIpICYmIHRoaXMuT3B0aW9ucy5TaG93T25seVR3ZWV0cykgfHxcbiAgICAgICgocFBvc3QuU291cmNlLm1hdGNoKFwibW9iaWxlXCIpIHx8IHBQb3N0LlNvdXJjZS5tYXRjaChcIlNNU1wiKSkgJiYgIXRoaXMuT3B0aW9ucy5TaG93TW9iaWxlUG9zdHMpIHx8XG4gICAgICAocFBvc3QuU291cmNlLm1hdGNoKFwid3d3LmZhY2Vib29rLmNvbVwiKSAmJiAhdGhpcy5PcHRpb25zLlNob3dGYWNlYm9va1Bvc3RzKSB8fFxuICAgICAgKCFwUG9zdC5Tb3VyY2UubWF0Y2goXCJ3d3cuZmFjZWJvb2suY29tXCIpICYmIHRoaXMuT3B0aW9ucy5TaG93T25seUZhY2Vib29rUG9zdHMpXG4gICAgKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHBvc3QgeW91IGFyZSB0cnlpbmcgdG8gYWRkIGlzIGFscmVhZHkgb24gdGhlIHBhZ2UsIHN0b3AgdHJ5aW5nIHRvIGFkZCBpdC5cbiAgICBmb3IgKHZhciBjID0gMDsgYyA8IHBQb3N0TGlzdC5sZW5ndGg7IGMrKykge1xuICAgICAgaWYgKHBQb3N0LklkID09PSBwYXJzZUludChwUG9zdExpc3RbY10pKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgYSBuZXcgbGlzdCBpdGVtIHdpdGggdGhlIHBvc3QgaWQgYXMgdGhlIGlkIGF0dHJpYnV0ZS5cbiAgICB2YXIgbmV3TGlzdEl0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG4gICAgbmV3TGlzdEl0ZW0uaWQgPSBwUG9zdC5JZDtcbiAgICBuZXdMaXN0SXRlbS5jbGFzc05hbWUgPSB0aGlzLk9wdGlvbnMuSXRlbUNsYXNzO1xuICAgIGlmIChwUG9zdC5SYW5rID09PSAwKSB7IG5ld0xpc3RJdGVtLmNsYXNzTmFtZSArPSBcIiBwaW5uZWRcIjsgfVxuXG4gICAgLy8gQ3JlYXRlIGl0ZW0gdGltZWxpbmVcbiAgICB2YXIgbmV3SXRlbVRpbWVsaW5lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRpbWVcIik7XG4gICAgbmV3SXRlbVRpbWVsaW5lLmNsYXNzTmFtZSA9IHRoaXMuT3B0aW9ucy5JdGVtVGltZWxpbmVDbGFzcztcbiAgICBuZXdJdGVtVGltZWxpbmUuaW5uZXJIVE1MID0gdGhpcy5nZXRUaW1lU2luY2UobmV3IERhdGUocFBvc3QuTGFzdE1vZGlmaWVkRGF0ZSkpO1xuXG4gICAgLy8gQ3JlYXRlIGl0ZW0gY29udGFpbmVyXG4gICAgdmFyIG5ld0l0ZW1Db250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIG5ld0l0ZW1Db250YWluZXIuY2xhc3NOYW1lID0gdGhpcy5PcHRpb25zLkl0ZW1Db250YWluZXJDbGFzcztcblxuICAgIC8vIENyZWF0ZSBpdGVtIGRlY2tcbiAgICB2YXIgbmV3SXRlbURlY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIG5ld0l0ZW1EZWNrLmNsYXNzTmFtZSA9IHRoaXMuT3B0aW9ucy5JdGVtRGVja0NsYXNzO1xuXG4gICAgLy8gSWYgdGhlcmUgaXMgYW4gYXZhdGFyIGFzc29jaWF0ZWQgd2l0aCB0aGUgY3JlYXRvciBvZiB0aGUgcG9zdCwgY3JlYXRlIGFuIGltYWdlIHRhZyB3aXRoIHRoZSBhdmF0YXIgdXJsIGFzIHRoZSBzcmMgYXR0cmlidXRlLlxuICAgIHZhciBuZXdJdGVtQXZhdGFySW1hZ2U7XG4gICAgaWYgKHBQb3N0LkNyZWF0b3IuQXZhdGFyICE9PSAnJyAmJiB0aGlzLk9wdGlvbnMuU2hvd0F2YXRhcnMpIHtcbiAgICAgIG5ld0l0ZW1BdmF0YXJJbWFnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbWdcIik7XG4gICAgICBuZXdJdGVtQXZhdGFySW1hZ2Uuc3JjID0gcFBvc3QuQ3JlYXRvci5BdmF0YXI7XG4gICAgICBuZXdJdGVtQXZhdGFySW1hZ2UuY2xhc3NOYW1lID0gdGhpcy5PcHRpb25zLkl0ZW1BdmF0YXJJbWFnZUNsYXNzO1xuICAgIH1cbiAgICBpZiAobmV3SXRlbUF2YXRhckltYWdlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIG5ld0l0ZW1EZWNrLmFwcGVuZENoaWxkKG5ld0l0ZW1BdmF0YXJJbWFnZSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGl0ZW0gYXV0aG9yIG5hbWUuIElmIHRoZSBzb3VyY2UgaXMgYSBzb2NpYWwgbmV0d29yaywgYWRkIGEgbGluayB0byB0aGUgc29jaWFsIG5ldHdvcmsgYWNjb3VudC5cbiAgICB2YXIgbmV3SXRlbUF1dGhvck5hbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIG5ld0l0ZW1BdXRob3JOYW1lLmNsYXNzTmFtZSA9IHRoaXMuT3B0aW9ucy5JdGVtQXZhdGFyTmFtZUNsYXNzO1xuICAgIG5ld0l0ZW1BdXRob3JOYW1lLmlubmVySFRNTCA9IHBQb3N0LkNyZWF0b3IuTmFtZTtcbiAgICBuZXdJdGVtRGVjay5hcHBlbmRDaGlsZChuZXdJdGVtQXV0aG9yTmFtZSk7XG5cbiAgICAvLyBDcmVhdGUgaXRlbSBkZWNrIHRpbWVcbiAgICB2YXIgbmV3SXRlbURlY2tUaW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBuZXdJdGVtRGVja1RpbWUuY2xhc3NOYW1lID0gdGhpcy5PcHRpb25zLkl0ZW1EZWNrVGltZUNsYXNzO1xuICAgIG5ld0l0ZW1EZWNrVGltZS5pbm5lckhUTUwgPSB0aGlzLmdldFRpbWVTaW5jZShuZXcgRGF0ZShwUG9zdC5MYXN0TW9kaWZpZWREYXRlKSk7XG4gICAgbmV3SXRlbURlY2suYXBwZW5kQ2hpbGQobmV3SXRlbURlY2tUaW1lKTtcblxuICAgIC8vIENyZWF0ZSBhIGRpdiB3aXRoIGEgY2xhc3Mgb2YgQ29udGVudCB0aGF0IGNvbnRhaW5zIHRoZSBwb3N0IGNvbnRlbnQuXG4gICAgdmFyIG5ld0NvbnRlbnREaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIG5ld0NvbnRlbnREaXYuY2xhc3NOYW1lID0gdGhpcy5PcHRpb25zLkl0ZW1Db250ZW50Q2xhc3M7XG5cbiAgICAvLyBJZiB0aGUgcG9zdCBpcyBhIGZhY2Vib29rOnBvc3QuXG4gICAgaWYgKHBQb3N0LlBvc3RNZXRhLlR5cGUgPT09IFwiZmFjZWJvb2s6cG9zdFwiKSB7XG4gICAgICB2YXIgZmFjZWJvb2tFbWJlZCA9IHBQb3N0LkNvbnRlbnQ7XG4gICAgICB2YXIgZmFjZWJvb2tFbWJlZFdpZHRoID0gdGhpcy5jdXJyZW50RGV2aWNlID09PSAnbW9iaWxlJyA/ICdhdXRvJyA6ICc1NDAnO1xuICAgICAgZmFjZWJvb2tFbWJlZCA9IGZhY2Vib29rRW1iZWQucmVwbGFjZSgnZGF0YS13aWR0aD1cIjUwMFwiJywgJ2RhdGEtd2lkdGg9XCInICsgZmFjZWJvb2tFbWJlZFdpZHRoICsgJ1wiJyk7XG4gICAgICBuZXdDb250ZW50RGl2LmNsYXNzTmFtZSArPSBcIiBmYWNlYm9vay1wb3N0XCI7XG4gICAgICBuZXdDb250ZW50RGl2LmlubmVySFRNTCA9IGZhY2Vib29rRW1iZWQ7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHBvc3QgaXMgYSB0d2l0dGVyOnR3ZWV0LlxuICAgIGVsc2UgaWYgKHBQb3N0LlBvc3RNZXRhLlR5cGUgPT09IFwidHdpdHRlcjp0d2VldFwiKSB7XG4gICAgICB2YXIgdHdpdHRlckVtYmVkID0gcFBvc3QuQ29udGVudDtcbiAgICAgIG5ld0NvbnRlbnREaXYuY2xhc3NOYW1lICs9IFwiIHR3aXR0ZXItdHdlZXRcIjtcbiAgICAgIG5ld0NvbnRlbnREaXYuaW5uZXJIVE1MID0gdHdpdHRlckVtYmVkO1xuICAgIH1cblxuICAgIC8vIFRPIERPOiBJZiB0aGUgcG9zdCBpcyBhIGluc3RhZ3JhbTpwb3N0LlxuICAgIC8vIGVsc2UgaWYgKHBQb3N0LlBvc3RNZXRhLlR5cGUgPT09IFwiaW5zdGFncmFtOnBvc3RcIikge1xuICAgIC8vICAgbmV3Q29udGVudERpdi5pbm5lckhUTUwgPSBwUG9zdC5Db250ZW50O1xuICAgIC8vIH1cblxuICAgIGVsc2UgaWYgKHBQb3N0LlBvc3RNZXRhLlR5cGUgPT09IFwieW91dHViZTpwb3N0XCIpIHtcbiAgICAgIHZhciB5b3V0dWJlRW1iZWQgPSBwUG9zdC5Db250ZW50O1xuICAgICAgdmFyIHlvdXR1YmVFbWJlZEhlaWd0aCA9IHRoaXMuY3VycmVudERldmljZSA9PT0gJ21vYmlsZScgPyAnYXV0bycgOiAnNDIwJztcbiAgICAgIHlvdXR1YmVFbWJlZCA9IHlvdXR1YmVFbWJlZC5yZXBsYWNlKCd3aWR0aD1cIjUwMFwiIGhlaWdodD1cIjMwMFwiJywgJ3dpZHRoPVwiMTAwJVwiIGhlaWdodD1cIicgKyB5b3V0dWJlRW1iZWRIZWlndGggKyAnXCInKTtcbiAgICAgIG5ld0NvbnRlbnREaXYuY2xhc3NOYW1lICs9IFwiIHlvdXR1YmUtcG9zdFwiO1xuICAgICAgbmV3Q29udGVudERpdi5pbm5lckhUTUwgPSB5b3V0dWJlRW1iZWQ7XG4gICAgfVxuXG4gICAgZWxzZSBpZiAocFBvc3QuTWVkaWEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbmV3Q29udGVudERpdi5pbm5lckhUTUwgPSB0aGlzLmFkZE1lZGlhKHBQb3N0KTtcbiAgICB9XG5cbiAgICAvLyBBZGQgYW55IGltYWdlLCB2aWRlbywgb3IgYXVkaW8gdG8gdGhlIHBvc3QgY29udGVudCBkaXYuXG4gICAgZWxzZSBpZiAocFBvc3QuTWVkaWEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbmV3Q29udGVudERpdi5pbm5lckhUTUwgPSB0aGlzLmFkZE1lZGlhKHBQb3N0KTtcbiAgICB9XG5cbiAgICAvLyBTaXRlIHByZXZpZXdcbiAgICBlbHNlIGlmIChwUG9zdC5Db250ZW50LmluZGV4T2YoJ3NjcmJibC1zaXRlUHJldmlldycpICE9PSAtMSkge1xuICAgICAgbmV3Q29udGVudERpdi5jbGFzc05hbWUgKz0gXCIgc2l0ZS1wcmV2aWV3XCI7XG4gICAgICBuZXdDb250ZW50RGl2LmlubmVySFRNTCA9IHBQb3N0LkNvbnRlbnQ7XG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSByZWd1bGFyIGNvbnRlbnQuXG4gICAgZWxzZSB7XG4gICAgICBuZXdDb250ZW50RGl2LmlubmVySFRNTCA9IHBQb3N0LkNvbnRlbnQ7XG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSBpdGVtIGRlY2sgYW5kIGl0ZW0gY29udGVudCB0byB0aGUgaXRlbSBjb250YWluZXIgZGl2LlxuICAgIG5ld0l0ZW1Db250YWluZXIuYXBwZW5kQ2hpbGQobmV3SXRlbURlY2spO1xuICAgIG5ld0l0ZW1Db250YWluZXIuYXBwZW5kQ2hpbGQobmV3Q29udGVudERpdik7XG5cbiAgICAvLyBBZGQgdGhlIHRpbWVsaW5lIGFuZCB0aGUgY29udGFpbmVyIGRpdiB0byB0aGUgbGlzdCBpdGVtLlxuICAgIG5ld0xpc3RJdGVtLmFwcGVuZENoaWxkKG5ld0l0ZW1UaW1lbGluZSk7XG4gICAgbmV3TGlzdEl0ZW0uYXBwZW5kQ2hpbGQobmV3SXRlbUNvbnRhaW5lcik7XG5cbiAgICB2YXIgcGlubmVkTGlzdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHRoaXMuT3B0aW9ucy5QaW5uZWRMaXN0Q2xhc3MpO1xuICAgIHZhciByZWd1bGFyTGlzdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHRoaXMuT3B0aW9ucy5SZWd1bGFyTGlzdENsYXNzKTtcblxuICAgIC8vIFJ1bGVzIGZvciBkZWZhdWx0IG5ldyBwb3N0c1xuICAgIGlmICh0eXBlID09PSAnUkVDRU5UJykge1xuXG4gICAgICAvLyBQaW5uZWQgUG9zdHNcbiAgICAgIGlmIChwUG9zdC5SYW5rID09PSAwKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kTm9kZShuZXdMaXN0SXRlbSwgcGlubmVkTGlzdCwgKHRoaXMuZmlyc3RSZW5kZXIgPyAnYm90dG9tJyA6ICd0b3AnKSk7XG5cbiAgICAgIC8vIFJlZ3VsYXIgUG9zdHNcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYXBwZW5kTm9kZShuZXdMaXN0SXRlbSwgcmVndWxhckxpc3QsICh0aGlzLmZpcnN0UmVuZGVyID8gJ2JvdHRvbScgOiAndG9wJykpO1xuICAgICAgfVxuXG4gICAgLy8gUnVsZXMgZm9yIGxvYWQtbW9yZSBvbGRlciBwb3N0c1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ09MREVSJykge1xuXG4gICAgICBpZiAodGhpcy5hZGRlZFBvc3RzIDwgdGhpcy5PcHRpb25zLlBvc3RzUGVyUGFnZSkge1xuICAgICAgICB0aGlzLmFwcGVuZE5vZGUobmV3TGlzdEl0ZW0sIHJlZ3VsYXJMaXN0LCAnYm90dG9tJyk7XG4gICAgICAgIHRoaXMuYWRkZWRQb3N0cysrO1xuICAgICAgICB0aGlzLmFkZGVkUG9zdHNDdXJyZW50Kys7XG4gICAgICB9XG5cbiAgICAgIC8vIE9ubHkgaW5jcmVtZW50cyB0aGUgcGFnZSB3aGVuIGFsbCBwb3N0cyBpbiB0aGUgcGFnZSBoYXZlIGFscmVhZHkgYmVlbiBsb2FkZWRcbiAgICAgIGlmICh0aGlzLmFkZGVkUG9zdHNDdXJyZW50ID09PSB0aGlzLk9wdGlvbnMuUG9zdHNQZXJQYWdlKSB7XG4gICAgICAgIHRoaXMuY3VycmVudFBhZ2UrKztcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLy8gVGhlIGZ1bmN0aW9uIHRoYXQgZGVsZXRlcyBhIHBvc3QuXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLmRlbGV0ZVBvc3QgPSBmdW5jdGlvbiAocFBvc3RJZCkge1xuICAgIHZhciBwb3N0VG9EZWxldGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChwUG9zdElkKTtcblxuICAgIGlmIChwb3N0VG9EZWxldGUgIT09IG51bGwpIHtcbiAgICAgIHBvc3RUb0RlbGV0ZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHBvc3RUb0RlbGV0ZSk7XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50UG9zdHNMaXN0ID0gdGhpcy5nZXRQb3N0TGlzdCgpO1xuICB9O1xuXG4gIC8vIFRoZSBmdW5jdGlvbiB0aGF0IGVkaXRzIGEgcG9zdCBieSBmaW5kaW5nIHRoZSBtYXRjaGluZyBwb3N0IGlkIGFuZCByZXBsYWNpbmcgdGhlIENvbnRlbnQgZGl2IGh0bWwuXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLmVkaXRQb3N0ID0gZnVuY3Rpb24gKHBQb3N0VG9FZGl0KSB7XG4gICAgdmFyIHBvc3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChwUG9zdFRvRWRpdC5JZCk7XG4gICAgdmFyIHBvc3RFbGVtZW50cyA9IHBvc3QuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJkaXZcIik7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb3N0RWxlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChwb3N0RWxlbWVudHNbaV0uY2xhc3NOYW1lLmluZGV4T2Yoc2VsZi5PcHRpb25zLkl0ZW1Db250ZW50Q2xhc3MpICE9PSAtMSkge1xuICAgICAgICBpZiAocFBvc3RUb0VkaXQuTWVkaWEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHBvc3RFbGVtZW50c1tpXS5pbm5lckhUTUwgPSB0aGlzLmFkZE1lZGlhKHBQb3N0VG9FZGl0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb3N0RWxlbWVudHNbaV0uaW5uZXJIVE1MID0gcFBvc3RUb0VkaXQuQ29udGVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFBpbiAvIFVucGluIHBvc3RzXG4gICAgICAgIGlmIChwUG9zdFRvRWRpdC5SYW5rID09PSAwICYmIHBvc3QucGFyZW50RWxlbWVudC5pZCA9PT0gdGhpcy5PcHRpb25zLlJlZ3VsYXJMaXN0Q2xhc3MpIHtcbiAgICAgICAgICB0aGlzLnBpblBvc3QocFBvc3RUb0VkaXQpO1xuXG4gICAgICAgIH0gZWxzZSBpZihwUG9zdFRvRWRpdC5SYW5rID09PSAxICYmIHBvc3QucGFyZW50RWxlbWVudC5pZCA9PT0gdGhpcy5PcHRpb25zLlBpbm5lZExpc3RDbGFzcykge1xuICAgICAgICAgIHRoaXMudW5waW5Qb3N0KHBQb3N0VG9FZGl0KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvLyBQaW5uIC8gVW5waW5uIHBvc3RzXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLnBpblBvc3QgPSBmdW5jdGlvbiAocFBvc3RUb1Bpbikge1xuICAgIHRoaXMuZGVsZXRlUG9zdChwUG9zdFRvUGluLklkKTtcbiAgICB0aGlzLmJ1aWxkUG9zdChwUG9zdFRvUGluLCB0aGlzLmN1cnJlbnRQb3N0c0xpc3QsICdSRUNFTlQnKTtcbiAgfTtcblxuICAvLyBQaW5uIC8gVW5waW5uIHBvc3RzXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLnVucGluUG9zdCA9IGZ1bmN0aW9uIChwUG9zdFRvVW5waW4pIHtcbiAgICB0aGlzLmRlbGV0ZVBvc3QocFBvc3RUb1VucGluLklkKTtcbiAgICB0aGlzLmJ1aWxkUG9zdChwUG9zdFRvVW5waW4sIHRoaXMuY3VycmVudFBvc3RzTGlzdCwgJ1JFQ0VOVCcpO1xuICB9O1xuXG4gIC8vIEFwcGVuZCBpdGVucyBpbiB0aGUgZG9tIHRyZWVcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuYXBwZW5kTm9kZSA9IGZ1bmN0aW9uIChwb3N0LCBsaXN0LCBwb3MpIHtcbiAgICB2YXIgcG9zaXRpb24gPSAodHlwZW9mIHBvcyA9PT0gJ3VuZGVmaW5lZCcpID8gJ3RvcCcgOiBwb3M7XG5cbiAgICBpZiAocG9zaXRpb24gPT09ICd0b3AnKSB7XG4gICAgICBsaXN0Lmluc2VydEJlZm9yZShwb3N0LCBsaXN0LmZpcnN0Q2hpbGQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LmFwcGVuZENoaWxkKHBvc3QpO1xuICAgIH1cblxuICAgIHRoaXMuY3VycmVudFBvc3RzTGlzdCA9IHRoaXMuZ2V0UG9zdExpc3QoKTtcbiAgfTtcblxuICAvLyBJZiB0aGVyZSBhcmUgZWRpdGVkIHBvc3RzLCBlZGl0IHRoZW0gaWYgdGhleSBhcmUgb24gdGhlIHBhZ2UgKGNvbXBhcmUgaWRzKSBhbmQgaGF2ZW4ndCBhbHJlYWR5IGJlZW4gZWRpdGVkIChjb21wYXJlIGxhc3QgbW9kaWZpZWQgdGltZXMpLlxuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5zaG91bGRQb3N0VXBkYXRlID0gZnVuY3Rpb24gKHBQb3N0KSB7XG4gICAgdmFyIHVwZGF0ZSA9IGZhbHNlO1xuXG4gICAgZm9yICh2YXIgYiA9IDA7IGIgPCB0aGlzLmN1cnJlbnRQb3N0c0xpc3QubGVuZ3RoOyBiKyspIHtcbiAgICAgIHZhciBQb3N0TGFzdE1vZGlmaWVkID0gTWF0aC5yb3VuZChuZXcgRGF0ZShwUG9zdC5MYXN0TW9kaWZpZWREYXRlKS5nZXRUaW1lKCkgLyAxMDAwLjApO1xuXG4gICAgICBpZiAocFBvc3QuSWQgPT09IHBhcnNlSW50KHRoaXMuY3VycmVudFBvc3RzTGlzdFtiXSkgJiYgUG9zdExhc3RNb2RpZmllZCA+IHRoaXMubGFzdE1vZGlmaWVkVGltZSkge1xuICAgICAgICB1cGRhdGUgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB1cGRhdGU7XG4gIH07XG5cbiAgLy8gQWRkIGFuIGVtcHR5IGxpc3QgdG8gdGhlIGVsZW1lbnQgc3BlY2lmaWVkIGluIHRoZSBzZXR1cCBhdCB0aGUgdG9wIG9mIHRoaXMgc2NyaXB0LlxuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5jcmVhdGVQb3N0TGlzdCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgd2lkZ2V0RGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICB3aWRnZXREaXYuc2V0QXR0cmlidXRlKFwiaWRcIiwgdGhpcy5PcHRpb25zLldpZGdldENsYXNzKTtcbiAgICB3aWRnZXREaXYuY2xhc3NOYW1lID0gdGhpcy5PcHRpb25zLldpZGdldENsYXNzO1xuXG4gICAgdmFyIHBpbm5lZExpc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidWxcIik7XG4gICAgcGlubmVkTGlzdC5zZXRBdHRyaWJ1dGUoXCJpZFwiLCB0aGlzLk9wdGlvbnMuUGlubmVkTGlzdENsYXNzKTtcbiAgICBwaW5uZWRMaXN0LmNsYXNzTmFtZSA9IHRoaXMuT3B0aW9ucy5QaW5uZWRMaXN0Q2xhc3MgKyBcIiBcIiArIHRoaXMuT3B0aW9ucy5JdGVuc0xpc3RDbGFzcztcblxuICAgIHZhciByZWd1bGFyTGlzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ1bFwiKTtcbiAgICByZWd1bGFyTGlzdC5zZXRBdHRyaWJ1dGUoXCJpZFwiLCB0aGlzLk9wdGlvbnMuUmVndWxhckxpc3RDbGFzcyk7XG4gICAgcmVndWxhckxpc3QuY2xhc3NOYW1lID0gdGhpcy5PcHRpb25zLlJlZ3VsYXJMaXN0Q2xhc3MgKyBcIiBcIiArIHRoaXMuT3B0aW9ucy5JdGVuc0xpc3RDbGFzcztcblxuICAgIHdpZGdldERpdi5hcHBlbmRDaGlsZChwaW5uZWRMaXN0KTtcbiAgICB3aWRnZXREaXYuYXBwZW5kQ2hpbGQocmVndWxhckxpc3QpO1xuXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodGhpcy5PcHRpb25zLldoZXJlVG9BZGRQb3N0cykuYXBwZW5kQ2hpbGQod2lkZ2V0RGl2KTtcbiAgfTtcblxuICAvLyBDcmVhdGUgYSBsaXN0IG9mIHBvc3RzIGN1cnJlbnRseSBvbiB0aGUgcGFnZSBieSBmaW5kaW5nIGFsbCBsaXN0IGl0ZW1zIGluc2lkZSB0aGUgc2NyaWJibGUtcG9zdHMtbGlzdCBsaXN0IGFuZCBhZGRpbmcgdGhlaXIgaWRzIHRvIGFuIGFycmF5LlxuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5nZXRQb3N0TGlzdCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY3VycmVudFBvc3RzTGlzdCA9IFtdO1xuICAgIHZhciBDdXJyZW50UG9zdHMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh0aGlzLk9wdGlvbnMuV2lkZ2V0Q2xhc3MpLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwibGlcIik7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBDdXJyZW50UG9zdHMubGVuZ3RoOyBqKyspIHtcbiAgICAgIGN1cnJlbnRQb3N0c0xpc3QucHVzaChDdXJyZW50UG9zdHNbal0uZ2V0QXR0cmlidXRlKFwiaWRcIikpO1xuICAgIH1cbiAgICByZXR1cm4gY3VycmVudFBvc3RzTGlzdDtcbiAgfTtcblxuICAvLyBUaGUgaW5pdGlhbCBBUEkgY2FsbCB0aGF0IGdldHMgYWxsIG9mIHRoZSBtb3N0IHJlY2VudCBwb3N0cyBhbmQgZmVlZHMgdGhlbSBiYWNrIGludG8gdGhpcyBzY3JpcHQuXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLmdldEFsbFBvc3RzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXF1ZXN0VXJsID0gdGhpcy5ob3N0bmFtZSArIFwic3RyZWFtL1wiICsgdGhpcy5PcHRpb25zLkV2ZW50SWQgKyBcIi9wb3N0cz9QYWdlTnVtYmVyPVwiICsgdGhpcy5jdXJyZW50UGFnZSArIFwiJlBhZ2VTaXplPVwiICsgdGhpcy5PcHRpb25zLlBvc3RzUGVyUGFnZSArIFwiJlRva2VuPVwiICsgdGhpcy5PcHRpb25zLkFQSVRva2VuO1xuICAgIHRoaXMucmVxdWVzdEFQSSgnR0VUJywgcmVxdWVzdFVybCwgdGhpcy5kcmF3TmV3UG9zdHMuYmluZCh0aGlzKSk7XG4gIH07XG5cbiAgLy8gR2V0IG5ldyBwb3N0cy5cbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZ2V0TmV3UG9zdHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy8gdmFyIHJlcXVlc3RVcmwgPSB0aGlzLmhvc3RuYW1lICsgXCJzdHJlYW0vXCIgKyB0aGlzLk9wdGlvbnMuRXZlbnRJZCArIFwiL3Bvc3RzL3NpbmNlP1RpbWVzdGFtcD1cIiArIHRoaXMubGFzdE1vZGlmaWVkVGltZSArXCImTWF4PVwiICsgdGhpcy5PcHRpb25zLlBvc3RzUGVyUGFnZSArIFwiJkluY2x1ZGVTdHJlYW1TdGF0dXM9dHJ1ZSZUb2tlbj1cIiArIHRoaXMuT3B0aW9ucy5BUElUb2tlbjtcbiAgICB2YXIgcmVxdWVzdFVybCA9IHRoaXMuaG9zdG5hbWUgKyBcInN0cmVhbS9cIiArIHRoaXMuT3B0aW9ucy5FdmVudElkICsgXCIvcG9zdHMvcmVjZW50P1RpbWVzdGFtcD1cIiArIHRoaXMubGFzdE1vZGlmaWVkVGltZSArIFwiJlRva2VuPVwiICsgdGhpcy5PcHRpb25zLkFQSVRva2VuO1xuICAgIGNvbnNvbGUubG9nKCdbU2NyaWJibGVMaXZlRmVlZF0gUG9vbGluZyAtIExvYWRpbmcgbmV3IHBvc3RzIC4uLicpO1xuICAgIHRoaXMucmVxdWVzdEFQSSgnR0VUJywgcmVxdWVzdFVybCwgdGhpcy5kcmF3TmV3UG9zdHMuYmluZCh0aGlzKSk7XG4gIH07XG5cbiAgLy8gUGFnaW5hdGUgdGhyb3VnaCB0aGUgb2xkZXN0IHBvc3RzXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLmdldE9sZGVyUG9zdHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlcXVlc3RVcmwgPSB0aGlzLmhvc3RuYW1lICsgXCJzdHJlYW0vXCIgKyB0aGlzLk9wdGlvbnMuRXZlbnRJZCArIFwiL3Bvc3RzP1BhZ2VOdW1iZXI9XCIgKyB0aGlzLmN1cnJlbnRQYWdlICsgXCImUGFnZVNpemU9XCIgKyB0aGlzLk9wdGlvbnMuUG9zdHNQZXJQYWdlICsgXCImVG9rZW49XCIgKyB0aGlzLk9wdGlvbnMuQVBJVG9rZW47XG4gICAgdGhpcy5sb2FkaW5nVXBkYXRlKHRydWUpO1xuICAgIHRoaXMucmVxdWVzdEFQSSgnR0VUJywgcmVxdWVzdFVybCwgdGhpcy5kcmF3T2xkZXJQb3N0cy5iaW5kKHRoaXMpKTtcbiAgfTtcblxuICAvLyBHZW5lcmljIEFKQVggTWV0aG9kXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLnJlcXVlc3RBUEkgPSBmdW5jdGlvbiAobWV0aG9kLCB1cmwsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHhtbGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4bWxodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICh4bWxodHRwLnJlYWR5U3RhdGUgPT09IDQgJiYgeG1saHR0cC5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICBjYWxsYmFjayhKU09OLnBhcnNlKHhtbGh0dHAucmVzcG9uc2VUZXh0KSk7XG4gICAgICB9XG4gICAgfTtcbiAgICB4bWxodHRwLm9uZXJyb3IgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgY29uc29sZS5sb2coJ1tTY3JpYmJsZV0gRXJyb3InLCBlKTtcbiAgICB9O1xuICAgIHhtbGh0dHAub3BlbihtZXRob2QsIHVybCwgdHJ1ZSk7XG4gICAgeG1saHR0cC5zZW5kKCk7XG4gIH07XG5cbiAgLy8gQ2FsbCBhbGwgc3BlY2lmaWMgbG9hZCBtZXRob2RzXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLmxvYWRFeHRlcm5hbFNjcmlwdHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuT3B0aW9ucy5TaG93VHdpdHRlclR3ZWV0cykgdGhpcy5sb2FkVHdpdHRlclNjcmlwdHMoKTtcbiAgICBpZiAodGhpcy5PcHRpb25zLlNob3dGYWNlYm9va1Bvc3RzKSB0aGlzLmxvYWRGYWNlYm9va1NjcmlwdHMoKTtcblxuICAgIHRoaXMubG9hZFNjcmliYmxlU2NyaXB0cygpO1xuICB9O1xuXG4gIC8vIExvYWQgU2NyaWJibGUgc2NyaXB0c1xuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5sb2FkU2NyaWJibGVTY3JpcHRzID0gZnVuY3Rpb24gKCkge1xuICAgIChmdW5jdGlvbiAodywgZCwgZWlkLCBzZWxmKSB7XG4gICAgICB2YXIgaWQgPSAnc2wtbGlianMnLFxuICAgICAgICB3aGVyZSA9IGQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpWzBdO1xuXG4gICAgICBpZiAoZC5nZXRFbGVtZW50QnlJZChpZCkpIHJldHVybjtcblxuICAgICAgdy5fc2xxID0gdy5fc2xxIHx8IFtdO1xuICAgICAgX3NscS5wdXNoKFsnX3NldEV2ZW50SWQnLCBlaWRdKTtcblxuICAgICAganMgPSBkLmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAganMuaWQgPSBpZDtcbiAgICAgIGpzLmFzeW5jID0gdHJ1ZTtcbiAgICAgIGpzLnNyYyA9ICdodHRwOi8vZW1iZWQuc2NyaWJibGVsaXZlLmNvbS9tb2R1bGVzL2xpYi9hZGRvbnMuanMnO1xuICAgICAgd2hlcmUucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoanMsIHdoZXJlKTtcbiAgICB9KHdpbmRvdywgZG9jdW1lbnQsIHRoaXMuT3B0aW9ucy5FdmVudElkLCB0aGlzKSk7XG4gIH07XG5cbiAgLy8gTG9hZCBUd2l0dGVyIHNjcmlwdHNcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUubG9hZFR3aXR0ZXJTY3JpcHRzID0gZnVuY3Rpb24gKCkge1xuICAgIHdpbmRvdy50d3R0ciA9IChmdW5jdGlvbiAoZCwgcywgaWQsIHNlbGYpIHtcbiAgICAgIHZhciBqcywgZmpzID0gZC5nZXRFbGVtZW50c0J5VGFnTmFtZShzKVswXSxcbiAgICAgICAgdCA9IHdpbmRvdy50d3R0ciB8fCB7fTtcbiAgICAgIGlmIChkLmdldEVsZW1lbnRCeUlkKGlkKSkgcmV0dXJuIHQ7XG4gICAgICBqcyA9IGQuY3JlYXRlRWxlbWVudChzKTtcbiAgICAgIGpzLmlkID0gaWQ7XG4gICAgICBqcy5zcmMgPSBcImh0dHBzOi8vcGxhdGZvcm0udHdpdHRlci5jb20vd2lkZ2V0cy5qc1wiO1xuICAgICAgZmpzLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGpzLCBmanMpO1xuICAgICAgdC5fZSA9IFtdO1xuICAgICAgdC5yZWFkeSA9IGZ1bmN0aW9uIChmKSB7XG4gICAgICAgIHQuX2UucHVzaChmKTtcbiAgICAgIH07XG4gICAgICByZXR1cm4gdDtcbiAgICB9KGRvY3VtZW50LCBcInNjcmlwdFwiLCBcInR3aXR0ZXItd2pzXCIsIHRoaXMpKTtcbiAgfTtcblxuICAvLyBMb2FkIEZhY2Vib29rIHNjcmlwdHNcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUubG9hZEZhY2Vib29rU2NyaXB0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZmJSb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBmYlJvb3QuaWQgPSBcImZiLXJvb3RcIjtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdib2R5JykuYXBwZW5kQ2hpbGQoZmJSb290KTtcbiAgICAoZnVuY3Rpb24gKGQsIHMsIGlkLCBzZWxmKSB7XG4gICAgICB2YXIganMsIGZqcyA9IGQuZ2V0RWxlbWVudHNCeVRhZ05hbWUocylbMF07XG4gICAgICBpZiAoZC5nZXRFbGVtZW50QnlJZChpZCkpIHJldHVybjtcbiAgICAgIGpzID0gZC5jcmVhdGVFbGVtZW50KHMpO1xuICAgICAganMuaWQgPSBpZDtcbiAgICAgIGpzLnNyYyA9IFwiLy9jb25uZWN0LmZhY2Vib29rLm5ldC9lbl9VUy9zZGsuanMjeGZibWw9MSZ2ZXJzaW9uPXYyLjdcIjtcbiAgICAgIGZqcy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShqcywgZmpzKTtcbiAgICB9KGRvY3VtZW50LCAnc2NyaXB0JywgJ2ZhY2Vib29rLWpzc2RrJywgdGhpcykpO1xuICB9O1xuXG4gIC8vIFVwZGF0ZSBMb2FkTW9yZSBCdG4gc3RhdGVcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUubG9hZGluZ1VwZGF0ZSA9IGZ1bmN0aW9uIChsb2FkaW5nKSB7XG4gICAgaWYgKHRoaXMuY3VycmVudFBhZ2UgPD0gdGhpcy50b3RhbFBhZ2VzKSB7XG4gICAgICBpZiAobG9hZGluZykge1xuICAgICAgICB0aGlzLmxvYWRNb3JlQnRuLmlubmVySFRNTCA9ICc8c3ZnIHdpZHRoPVwiNTJweFwiIGhlaWdodD1cIjUycHhcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgdmlld0JveD1cIjAgMCAxMDAgMTAwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cInhNaWRZTWlkXCIgY2xhc3M9XCJ1aWwtcmluZy1hbHRcIiBzdHlsZT1cIiBoZWlnaHQ6IDMwcHg7XCI+PHJlY3QgeD1cIjBcIiB5PVwiMFwiIHdpZHRoPVwiMTAwXCIgaGVpZ2h0PVwiMTAwXCIgZmlsbD1cIm5vbmVcIiBjbGFzcz1cImJrXCI+PC9yZWN0PjxjaXJjbGUgY3g9XCI1MFwiIGN5PVwiNTBcIiByPVwiNDBcIiBzdHJva2U9XCIjZDBkMGQwXCIgZmlsbD1cIm5vbmVcIiBzdHJva2Utd2lkdGg9XCIxMFwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIj48L2NpcmNsZT48Y2lyY2xlIGN4PVwiNTBcIiBjeT1cIjUwXCIgcj1cIjQwXCIgc3Ryb2tlPVwiIzU1NTU1NVwiIGZpbGw9XCJub25lXCIgc3Ryb2tlLXdpZHRoPVwiNlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIj48YW5pbWF0ZSBhdHRyaWJ1dGVOYW1lPVwic3Ryb2tlLWRhc2hvZmZzZXRcIiBkdXI9XCIyc1wiIHJlcGVhdENvdW50PVwiaW5kZWZpbml0ZVwiIGZyb209XCIwXCIgdG89XCI1MDJcIj48L2FuaW1hdGU+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT1cInN0cm9rZS1kYXNoYXJyYXlcIiBkdXI9XCIyc1wiIHJlcGVhdENvdW50PVwiaW5kZWZpbml0ZVwiIHZhbHVlcz1cIjE3NS43IDc1LjMwMDAwMDAwMDAwMDAxOzEgMjUwOzE3NS43IDc1LjMwMDAwMDAwMDAwMDAxXCI+PC9hbmltYXRlPjwvY2lyY2xlPjwvc3ZnPic7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxvYWRNb3JlQnRuLmlubmVySFRNTCA9IFwiRXhpYmlyIE1haXMgPGk+PC9pPlwiO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmxvYWRNb3JlQnRuLmRpc2FibGVkID0gZmFsc2U7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5sb2FkTW9yZUJ0bi5pbm5lckhUTUwgPSBcIkV4aWJpciBNYWlzIDxpPjwvaT5cIjtcbiAgICAgIHRoaXMubG9hZE1vcmVCdG4uZGlzYWJsZWQgPSB0cnVlO1xuICAgIH1cbiAgfTtcblxuICAvLyBHZW5lcmljIFRpbWUtU2luY2UgZnVuY3Rpb25cbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZ2V0VGltZVNpbmNlID0gZnVuY3Rpb24gKHByZXZpb3VzKSB7XG4gICAgdmFyIG1zUGVyTWludXRlID0gNjAgKiAxMDAwLFxuICAgICAgbXNQZXJIb3VyID0gbXNQZXJNaW51dGUgKiA2MCxcbiAgICAgIG1zUGVyRGF5ID0gbXNQZXJIb3VyICogMjQsXG4gICAgICBtc1Blck1vbnRoID0gbXNQZXJEYXkgKiAzMCxcbiAgICAgIG1zUGVyWWVhciA9IG1zUGVyRGF5ICogMzY1LFxuICAgICAgY3VycmVudCA9IG5ldyBEYXRlKCksXG4gICAgICBzaW5jZSA9IGN1cnJlbnQgLSBwcmV2aW91cztcblxuICAgIGlmIChzaW5jZSA8IG1zUGVyTWludXRlKSB7XG4gICAgICByZXR1cm4gJ0jDoSAnICsgTWF0aC5yb3VuZChzaW5jZSAvIDEwMDApICsgJyBzZWcnO1xuICAgIH0gZWxzZSBpZiAoc2luY2UgPCBtc1BlckhvdXIpIHtcbiAgICAgIHJldHVybiAnSMOhICcgKyBNYXRoLnJvdW5kKHNpbmNlIC8gbXNQZXJNaW51dGUpICsgJyBtaW4nO1xuICAgIH0gZWxzZSBpZiAoc2luY2UgPCBtc1BlckRheSkge1xuICAgICAgaWYgKE1hdGgucm91bmQoc2luY2UgLyBtc1BlckhvdXIpID09PSAxKSByZXR1cm4gJ0jDoSAnICsgTWF0aC5yb3VuZChzaW5jZSAvIG1zUGVySG91cikgKyAnIGhvcmEnO1xuICAgICAgcmV0dXJuICdIw6EgJyArIE1hdGgucm91bmQoc2luY2UgLyBtc1BlckhvdXIpICsgJyBob3Jhcyc7XG4gICAgfSBlbHNlIGlmIChzaW5jZSA8IG1zUGVyTW9udGgpIHtcbiAgICAgIGlmIChNYXRoLnJvdW5kKHNpbmNlIC8gbXNQZXJEYXkpID09PSAxKSByZXR1cm4gJ0jDoSAnICsgTWF0aC5yb3VuZChzaW5jZSAvIG1zUGVyRGF5KSArICcgZGlhJztcbiAgICAgIHJldHVybiAnSMOhICcgKyBNYXRoLnJvdW5kKHNpbmNlIC8gbXNQZXJEYXkpICsgJyBkaWFzJztcbiAgICB9IGVsc2UgaWYgKHNpbmNlIDwgbXNQZXJZZWFyKSB7XG4gICAgICBpZiAoTWF0aC5yb3VuZChzaW5jZSAvIG1zUGVyTW9udGgpID09PSAxKSByZXR1cm4gJ0jDoSAnICsgTWF0aC5yb3VuZChzaW5jZSAvIG1zUGVyTW9udGgpICsgJyBtw6pzJztcbiAgICAgIHJldHVybiAnSMOhICcgKyBNYXRoLnJvdW5kKHNpbmNlIC8gbXNQZXJNb250aCkgKyAnIG1lc2VzJztcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKE1hdGgucm91bmQoc2luY2UgLyBtc1BlclllYXIpID09PSAxKSByZXR1cm4gJ0jDoSAnICsgTWF0aC5yb3VuZChzaW5jZSAvIG1zUGVyWWVhcikgKyAnIGFubyc7XG4gICAgICByZXR1cm4gJ0jDoSAnICsgTWF0aC5yb3VuZChzaW5jZSAvIG1zUGVyWWVhcikgKyAnIGFub3MnO1xuICAgIH1cbiAgfTtcblxuICAvLyBHZW5lcmljIGZ1bmN0aW9uIHRvIGdldCBDdXJyZW50IERldmljZVxuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5nZXRDdXJyRGV2aWNlID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB3ID0gd2luZG93LmlubmVyV2lkdGggfHwgd2luZG93LmNsaWVudFdpZHRoIHx8IHdpbmRvdy5jbGllbnRXaWR0aDtcbiAgICByZXR1cm4gKHcgPD0gNzY4KSA/ICdtb2JpbGUnIDogKHcgPD0gMTAyNCkgPyAndGFibGV0JyA6ICdkZXNrdG9wJztcbiAgfTtcblxuICByZXR1cm4gU2NyaWJibGVMaXZlRmVlZDtcblxufSkpKTtcbiJdfQ==
