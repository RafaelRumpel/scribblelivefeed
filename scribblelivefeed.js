/*

Title: ScribbleLive Feed
Description: The Scribble Live Feed Widget, create a news feed with the most recent posts in your ScribbleLive Stream. This project is a fork of the recent-posts widget by Matt Mccausland.
Author: Rafael Rumpel
Github: https://github.com/RafaelRumpel/scribblelivefeed

*/

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.scribblelivefeed = factory() // jshint ignore:line
}(this, (function () {

  var ScribbleLiveFeed = function (Options) {

    this.version = '2.5.6';

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
      var wait = setTimeout(function() { self.getNewPosts(); }, this.Options.PoolingTime);

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

    // Get new post type
    var newPostType = (typeof pPost.PostMeta.Type !== 'undefined') ? pPost.PostMeta.Type : 'scribble:post';

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

    // Create a div with a class of Content that contains the post content.
    var newContentDiv = document.createElement("div");
    newContentDiv.className = this.Options.ItemContentClass;

    if (newPostType === "scribble:post") {
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

      newItemContainer.appendChild(newItemDeck);
      newContentDiv.innerHTML = pPost.Content;
    }

    // If the post is a facebook:post.
    else if (newPostType === "facebook:post") {
      var facebookEmbed = pPost.Content;
      var facebookEmbedWidth = this.currentDevice === 'mobile' ? 'auto' : '575';
      facebookEmbed = facebookEmbed.replace('data-width="500"', 'data-width="' + facebookEmbedWidth + '"');
      newContentDiv.className += " facebook-post";
      newContentDiv.innerHTML = facebookEmbed;
    }

    // If the post is a twitter:tweet.
    else if (newPostType === "twitter:tweet") {
      var twitterEmbed = '<blockquote class="twitter-tweet twitter-blockquote">' + pPost.Source + '</blockquote>';
      newContentDiv.className += " twitter-tweet";
      newContentDiv.innerHTML = twitterEmbed;
    }

    // TO DO: If the post is a instagram:post.
    // else if (newPostType === "instagram:post") {
    //   newContentDiv.innerHTML = pPost.Content;
    // }

    else if (newPostType === "youtube:post") {
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
        this.loadMoreBtn.innerHTML = '<svg width="52px" height="52px" xmlns="//www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" class="uil-ring-alt" style=" height: 30px;"><rect x="0" y="0" width="100" height="100" fill="none" class="bk"></rect><circle cx="50" cy="50" r="40" stroke="#d0d0d0" fill="none" stroke-width="10" stroke-linecap="round"></circle><circle cx="50" cy="50" r="40" stroke="#555555" fill="none" stroke-width="6" stroke-linecap="round"><animate attributeName="stroke-dashoffset" dur="2s" repeatCount="indefinite" from="0" to="502"></animate><animate attributeName="stroke-dasharray" dur="2s" repeatCount="indefinite" values="175.7 75.30000000000001;1 250;175.7 75.30000000000001"></animate></circle></svg>';
      } else {
        this.loadMoreBtn.innerHTML = "Exibir Mais <i></i>";
      }

      this.loadMoreBtn.disabled = false;

    } else {
      this.loadMoreBtn.innerHTML = "Fim";
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNjcmliYmxlbGl2ZWZlZWQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6InNjcmliYmxlbGl2ZWZlZWQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuXG5UaXRsZTogU2NyaWJibGVMaXZlIEZlZWRcbkRlc2NyaXB0aW9uOiBUaGUgU2NyaWJibGUgTGl2ZSBGZWVkIFdpZGdldCwgY3JlYXRlIGEgbmV3cyBmZWVkIHdpdGggdGhlIG1vc3QgcmVjZW50IHBvc3RzIGluIHlvdXIgU2NyaWJibGVMaXZlIFN0cmVhbS4gVGhpcyBwcm9qZWN0IGlzIGEgZm9yayBvZiB0aGUgcmVjZW50LXBvc3RzIHdpZGdldCBieSBNYXR0IE1jY2F1c2xhbmQuXG5BdXRob3I6IFJhZmFlbCBSdW1wZWxcbkdpdGh1YjogaHR0cHM6Ly9naXRodWIuY29tL1JhZmFlbFJ1bXBlbC9zY3JpYmJsZWxpdmVmZWVkXG5cbiovXG5cbjsoZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuICAgIHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyA/IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpIDpcbiAgICB0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoZmFjdG9yeSkgOlxuICAgIGdsb2JhbC5zY3JpYmJsZWxpdmVmZWVkID0gZmFjdG9yeSgpIC8vIGpzaGludCBpZ25vcmU6bGluZVxufSh0aGlzLCAoZnVuY3Rpb24gKCkge1xuXG4gIHZhciBTY3JpYmJsZUxpdmVGZWVkID0gZnVuY3Rpb24gKE9wdGlvbnMpIHtcblxuICAgIHRoaXMudmVyc2lvbiA9ICcyLjUuNic7XG5cbiAgICB0aGlzLk9wdGlvbnMgPSB7XG4gICAgICAvLyBZb3UgY2FuIGZpbmQgeW91ciBBUEkgdG9rZW5zIC0gYW5kIGdlbmVyYXRlIG5ldyBvbmVzIC0gdW5kZXIgdGhlIGdlbmVyYWwgQVBJIHNlY3Rpb24gb2YgeW91ciBTY3JpYmJsZUxpdmUgYmFjayBlbmQuIGh0dHBzOi8vY2xpZW50LnNjcmliYmxlbGl2ZS5jb20vY2xpZW50L0FQSS5hc3B4XG4gICAgICBBUElUb2tlbjogJycsXG4gICAgICAvLyBZb3UgY2FuIGZpbmQgeW91ciBldmVudCBpZCB1bmRlciB0aGUgQVBJIHNlY3Rpb24gb2YgeW91ciBldmVudCBpbiB0aGUgU2NyaWJibGVMaXZlIGJhY2sgZW5kLiBZb3UgY2FuIGFsc28gdmlldyBzb3VyY2Ugb24geW91ciBldmVudCBhbmQgc2VhcmNoIGZvciBcIlRocmVhZElkXCIuXG4gICAgICBFdmVudElkOiAnJyxcbiAgICAgIC8vIFRoZSBudW1iZXIgb2YgcG9zdHMgeW91IHdvdWxkIGxpa2UgdG8gZGlzcGxheS5cbiAgICAgIFBvc3RzUGVyUGFnZTogMTAsXG4gICAgICAvLyBUaGUgaWQgb2YgdGhlIGVsZW1lbnQgb24geW91ciBwYWdlIHdoZXJlIHlvdSB3b3VsZCBsaWtlIHRvIGRpc3BsYXkgdGhlIHBvc3RzLlxuICAgICAgV2hlcmVUb0FkZFBvc3RzOiAnJyxcbiAgICAgIC8vIFRoZSBudW1iZXIgb2Ygc2Vjb25kcyB5b3Ugd2FudCB0byBjaGVjayBmb3IgbmV3IHN0cmVhbXNcbiAgICAgIFBvb2xpbmdUaW1lOiAzMTAwMCxcbiAgICAgIC8vIFBvb2xpbmdUaW1lOiA1MDAwLCAvL2RlYnVnIG9ubHlcbiAgICAgIC8vIFNob3cgaW1hZ2VzLCB0cnVlIG9yIGZhbHNlLlxuICAgICAgU2hvd0ltYWdlczogdHJ1ZSxcbiAgICAgIC8vIFNob3cgdmlkZW9zLCB0cnVlIG9yIGZhbHNlLlxuICAgICAgU2hvd1ZpZGVvczogdHJ1ZSxcbiAgICAgIC8vIFNob3cgYXVkaW8sIHRydWUgb3IgZmFsc2UuXG4gICAgICBTaG93QXVkaW86IHRydWUsXG4gICAgICAvLyBTaG93IHN0dWNrIHBvc3RzLCB0cnVlIG9yIGZhbHNlLlxuICAgICAgU2hvd1N0dWNrUG9zdHM6IHRydWUsXG4gICAgICAvLyBTaG93IGF2YXRhcnMsIHRydWUgb3IgZmFsc2UuXG4gICAgICBTaG93QXZhdGFyczogdHJ1ZSxcbiAgICAgIC8vIFNob3cgdGV4dCBwb3N0cywgdHJ1ZSBvciBmYWxzZS5cbiAgICAgIFNob3dUZXh0UG9zdHM6IHRydWUsXG4gICAgICAvLyBTaG93IG1lZGlhIGNhcHRpb25zLCB0cnVlIG9yIGZhbHNlLlxuICAgICAgU2hvd0NhcHRpb25zOiB0cnVlLFxuICAgICAgLy8gU2hvdyBjb21tZW50cywgdHJ1ZSBvciBmYWxzZS5cbiAgICAgIFNob3dDb21tZW50czogdHJ1ZSxcbiAgICAgIC8vIFNob3cgb2ZmaWNpYWwgKHdyaXRlciwgZWRpdG9yLCBtb2RlcmF0b3IsIGFkbWluaXN0cmF0b3IsIGd1ZXN0IHdyaXRlciwgZXRjLikgcG9zdHMsIHRydWUgb3IgZmFsc2UuXG4gICAgICBTaG93T2ZmaWNpYWxQb3N0czogdHJ1ZSxcbiAgICAgIC8vIFNob3cgVHdpdHRlciBwb3N0cywgdHJ1ZSBvciBmYWxzZS5cbiAgICAgIFNob3dUd2l0dGVyVHdlZXRzOiB0cnVlLFxuICAgICAgLy8gU2hvdyBtb2JpbGUgcG9zdHMsIHRydWUgb2YgZmFsc2UuXG4gICAgICBTaG93TW9iaWxlUG9zdHM6IHRydWUsXG4gICAgICAvLyBTaG93IEZhY2Vib29rIHBvc3RzLCB0cnVlIG9yIGZhbHNlLlxuICAgICAgU2hvd0ZhY2Vib29rUG9zdHM6IHRydWUsXG4gICAgICAvLyBTaG93IG9ubHkgVHdpdHRlciBwb3N0cywgdHJ1ZSBvciBmYWxzZS5cbiAgICAgIFNob3dPbmx5VHdlZXRzOiBmYWxzZSxcbiAgICAgIC8vIFNob3cgb25seSBGYWNlYm9vayBwb3N0cywgdHJ1ZSBvciBmYWxzZS5cbiAgICAgIFNob3dPbmx5RmFjZWJvb2tQb3N0czogZmFsc2UsXG4gICAgICAvLyBDU1MgY2xhc3Nlc1xuICAgICAgV2lkZ2V0Q2xhc3M6ICdzY3JpYmJsZS1wb3N0cy13cmFwcGVyJyxcbiAgICAgIFBpbm5lZExpc3RDbGFzczogJ3NjcmliYmxlLXBpbm5lZC1saXN0JyxcbiAgICAgIFJlZ3VsYXJMaXN0Q2xhc3M6ICdzY3JpYmJsZS1yZWd1bGFyLWxpc3QnLFxuICAgICAgSXRlbnNMaXN0Q2xhc3M6ICdzY3JpYmJsZS1wb3N0cy1saXN0JyxcbiAgICAgIEl0ZW1DbGFzczogJ3NjcmliYmxlLXBvc3QtaXRlbScsXG4gICAgICBJdGVtVGltZWxpbmVDbGFzczogJ3Bvc3QtdGltZWxpbmUnLFxuICAgICAgSXRlbUNvbnRhaW5lckNsYXNzOiAncG9zdC1jb250YWluZXInLFxuICAgICAgSXRlbURlY2tDbGFzczogJ3Bvc3QtZGVjaycsXG4gICAgICBJdGVtQXZhdGFySW1hZ2VDbGFzczogJ3Bvc3QtYXV0aG9yLWF2YXRhcicsXG4gICAgICBJdGVtQXZhdGFyTmFtZUNsYXNzOiAncG9zdC1hdXRob3ItbmFtZScsXG4gICAgICBJdGVtRGVja1RpbWVDbGFzczogJ3Bvc3QtZGVjay10aW1lJyxcbiAgICAgIEl0ZW1Db250ZW50Q2xhc3M6ICdwb3N0LWNvbnRlbnQnXG4gICAgfTtcblxuICAgIC8vIFNldCB0aGUgb3B0aW9uIHZhbHVlcyB0byB0aGUgdmFsdWVzIHBhc3NlZCBpbiB0byB0aGUgZnVuY3Rpb24uXG4gICAgZm9yICh2YXIgb3B0IGluIE9wdGlvbnMpIHtcbiAgICAgIGlmIChPcHRpb25zLmhhc093blByb3BlcnR5KG9wdCkpIHtcbiAgICAgICAgdGhpcy5PcHRpb25zW29wdF0gPSBPcHRpb25zW29wdF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRGVmYXVsdCBBUEkgaG9zdGFtZVxuICAgIHRoaXMuaG9zdG5hbWUgPSAnaHR0cHM6Ly9hcGkuc2NyaWJibGVsaXZlLmNvbS92MS8nO1xuXG4gICAgLy8gVXNlZCB0byBtYXRjaCB0aGUgRGFmYXVsdCBBUEkgaG9zdG5hbWVcbiAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSAnXlxcaHR0cHM6XFwvXFwvYXBpXFwuc2NyaWJibGVsaXZlXFwuY29tL3YxLyc7XG5cbiAgICAvLyBDb250cm9scyBwYWdpbmF0aW9uXG4gICAgdGhpcy5jdXJyZW50UGFnZSA9IDA7XG5cbiAgICAvLyBUb3RhbCBwYWdpbmF0aW9uXG4gICAgdGhpcy50b3RhbFBhZ2VzID0gMDtcblxuICAgIC8vIENvdW50IGFkZGVkIHBvc3RzXG4gICAgdGhpcy5hZGRlZFBvc3RzID0gMDtcblxuICAgIC8vIElzIGZpcnN0IHJlbmRlclxuICAgIHRoaXMuZmlyc3RSZW5kZXIgPSB0cnVlO1xuXG4gICAgLy8gQ291bnQgYWRkZWQgcG9zdHMgaW4gY3VycmVudCBwYWdlXG4gICAgdGhpcy5hZGRlZFBvc3RzQ3VycmVudCA9IDA7XG5cbiAgICAvLyBTYXZlIGVtYmVkZWQgdHdlZXRzIHRvIGF2b2lkIGR1cGxpY2F0ZWQgZW1iZWRzLlxuICAgIHRoaXMubG9hZGVkVHdlZXRzID0gW107XG5cbiAgICAvLyBTZXQgdGhlIGxhc3QgbW9kaWZpZWQgdGltZSB2YXJpYWJsZSAoVVRDIEVwb2NoIFRpbWVzdGFtcCBmb3JtYXQpLlxuICAgIHRoaXMubGFzdE1vZGlmaWVkVGltZSA9ICcnO1xuXG4gICAgLy8gTGlzdCBjb250YWluaW5nIGFsbCBwb3N0cyBpZHNcbiAgICB0aGlzLmN1cnJlbnRQb3N0c0xpc3QgPSBbXTtcblxuICAgIC8vIEdldCB0aGUgY3VycmVudCB1c2VyIGRldmljZVxuICAgIHRoaXMuY3VycmVudERldmljZSA9IHRoaXMuZ2V0Q3VyckRldmljZSgpO1xuXG4gICAgLy8gTG9hZCBleHRlcm5hbCBzY3JpcHRzXG4gICAgdGhpcy5sb2FkRXh0ZXJuYWxTY3JpcHRzKCk7XG5cbiAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgdGhlIGVsZW1lbnQgdGhhdCB0aGUgcG9zdHMgd2lsbCBiZSBhZGRlZCB0by5cbiAgICB0aGlzLmNyZWF0ZVBvc3RMaXN0KCk7XG5cbiAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiB0aGF0IGxvYWRzIHRoZSBtb3N0IHJlY2VudCBwb3N0cy5cbiAgICB0aGlzLmdldEFsbFBvc3RzKCk7XG4gIH07XG5cbiAgLy8gR2V0IHJlY2VudCBwb3N0cyBmcm9tIHRoZSBBUElcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZHJhd05ld1Bvc3RzID0gZnVuY3Rpb24gKHBSZXNwb25zZSkge1xuICAgIHRoaXMuZHJhd1Bvc3RzKHBSZXNwb25zZSwgJ1JFQ0VOVCcpO1xuICB9O1xuXG4gIC8vIEdldCBvbGRlciBwb3N0cyBmcm9tIHRoZSBBUElcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZHJhd09sZGVyUG9zdHMgPSBmdW5jdGlvbiAocFJlc3BvbnNlKSB7XG4gICAgdGhpcy5kcmF3UG9zdHMocFJlc3BvbnNlLCAnT0xERVInKTtcbiAgfTtcblxuICAvLyBUaGUgZnVuY3Rpb24gdGhhdCBkZWNpZGVzIHdoYXQgdG8gZG8gd2l0aCB0aGUgcmVzcG9uc2UgaXQgZ2V0cyBiYWNrIGZyb20gdGhlIGFwaS5cbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZHJhd1Bvc3RzID0gZnVuY3Rpb24gKHBSZXNwb25zZSwgdHlwZSkge1xuICAgIHZhciBuZXdQb3N0c0xpc3QgPSB0aGlzLmN1cnJlbnRQb3N0c0xpc3Q7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdGhpcy5hZGRlZFBvc3RzQ3VycmVudCA9IDA7XG4gICAgdGhpcy50b3RhbFBhZ2VzID0gdHlwZW9mIHBSZXNwb25zZS5wYWdpbmF0aW9uICE9PSAndW5kZWZpbmVkJyA/IHBSZXNwb25zZS5wYWdpbmF0aW9uLlRvdGFsUGFnZXMgOiB0aGlzLnRvdGFsUGFnZXM7XG5cbiAgICAvLyBVcGRhdGUgcG9zdHNcbiAgICBpZiAocFJlc3BvbnNlLnBvc3RzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGZvciAodmFyIHAgPSAwOyBwIDwgcFJlc3BvbnNlLnBvc3RzLmxlbmd0aDsgcCsrKSB7XG5cbiAgICAgICAgLy8gSWYgdGhlcmUgYXJlIGRlbGV0ZWQgcG9zdHMsIGNoZWNrIGlmIHRoZXkgYXJlIG9uIHRoZSBwYWdlLCBhbmQgZGVsZXRlZCB0aGVtIGlmIHRoZXkgYXJlLlxuICAgICAgICBpZiAocFJlc3BvbnNlLnBvc3RzW3BdLklzRGVsZXRlZCkge1xuICAgICAgICAgIHRoaXMuZGVsZXRlUG9zdChwUmVzcG9uc2UucG9zdHNbcF0uSWQpO1xuXG4gICAgICAgIC8vIEVkaXQgLyBBZGQgbmV3IHBvc3RzLlxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnRQb3N0c0xpc3QubGVuZ3RoICE9PSAwICYmIHRoaXMuc2hvdWxkUG9zdFVwZGF0ZShwUmVzcG9uc2UucG9zdHNbcF0pKSB7XG4gICAgICAgICAgICB0aGlzLmVkaXRQb3N0KHBSZXNwb25zZS5wb3N0c1twXSk7XG5cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5idWlsZFBvc3QocFJlc3BvbnNlLnBvc3RzW3BdLCB0aGlzLmN1cnJlbnRQb3N0c0xpc3QsIHR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBJbnNlcnQgbG9hZCBtb3JlIGJ0biBhZnRlciBmaXJzdCByZW5kZXIuXG4gICAgICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjcmliYmxlLWxvYWQtbW9yZScpID09PSBudWxsKSB0aGlzLmRyYXdMb2FkTW9yZUJ0bigpO1xuXG4gICAgICAvLyBSZW5kZXIgRW1iZWRlZCBQb3N0c1xuICAgICAgdGhpcy5kcmF3RW1iZWRzKCk7XG4gICAgfVxuXG4gICAgLy8gTG9hZCBuZXcgcG9zdHMgcnVsZXNcbiAgICBpZiAodHlwZSA9PT0gJ1JFQ0VOVCcpIHtcblxuICAgICAgLy8gR2V0IHRoZSB0aW1lIHRoZSBldmVudCB3YXMgbGFzdCBtb2RpZmllZCBhbmQgZm9ybWF0IHRoYXQgdGltZSBzbyBpdCBjYW4gYmUgcGFzc2VkIGJhY2sgdG8gdGhlIFNjcmliYmxlTGl2ZSBBUEkuXG4gICAgICBpZiAocFJlc3BvbnNlLnBvc3RzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdmFyIGxhc3RQb3N0VGltZSA9IG5ldyBEYXRlKHBSZXNwb25zZS5wb3N0c1swXS5MYXN0TW9kaWZpZWREYXRlKTtcbiAgICAgICAgdGhpcy5sYXN0TW9kaWZpZWRUaW1lID0gTWF0aC5yb3VuZChsYXN0UG9zdFRpbWUuZ2V0VGltZSgpIC8gMTAwMC4wKTtcbiAgICAgIH1cblxuICAgICAgLy8gTWFrZSB0aGUgY2FsbCB0byB0aGUgQVBJIGZvciB1cGRhdGVzIChQb29saW5nKS5cbiAgICAgIHZhciB3YWl0ID0gc2V0VGltZW91dChmdW5jdGlvbigpIHsgc2VsZi5nZXROZXdQb3N0cygpOyB9LCB0aGlzLk9wdGlvbnMuUG9vbGluZ1RpbWUpO1xuXG4gICAgLy8gTG9hZCBvbGRlciBwb3N0cyBydWxlc1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ09MREVSJykge1xuICAgICAgdmFyIGFkZGVkUG9zdHMgPSBuZXdQb3N0c0xpc3QubGVuZ3RoIC0gdGhpcy5jdXJyZW50UG9zdHNMaXN0Lmxlbmd0aDtcblxuICAgICAgbmV3UG9zdHNMaXN0ID0gdGhpcy5nZXRQb3N0TGlzdCgpO1xuXG4gICAgICBpZiAodGhpcy5hZGRlZFBvc3RzID09PSB0aGlzLk9wdGlvbnMuUG9zdHNQZXJQYWdlKSB7XG4gICAgICAgIHRoaXMuYWRkZWRQb3N0cyA9IDA7XG4gICAgICAgIHRoaXMubG9hZGluZ1VwZGF0ZShmYWxzZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgeW91IGRvIG5vdCBnZXQgYWxsIHByZWRlZmluZWQgcG9zdHMsIGRvIGFub3RoZXIgZ2V0IHRvIGNvbXBsZXRlLlxuICAgICAgaWYgKCh0aGlzLmN1cnJlbnRQYWdlIDw9IHRoaXMudG90YWxQYWdlcykgJiYgKGFkZGVkUG9zdHMgPCB0aGlzLk9wdGlvbnMuUG9zdHNQZXJQYWdlKSkge1xuICAgICAgICB0aGlzLmN1cnJlbnRQYWdlKys7XG4gICAgICAgIHRoaXMuZ2V0T2xkZXJQb3N0cygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuZmlyc3RSZW5kZXIgPSBmYWxzZTtcbiAgfTtcblxuICAvLyBDb25maWd1cmUgdGhlIEVtYmVkcyBzcGVjaWZpYyBkcmF3IG1ldGhvZHNcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZHJhd0VtYmVkcyA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5PcHRpb25zLlNob3dUd2l0dGVyVHdlZXRzKSB7XG4gICAgICB2YXIgdHdlZXRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgndHdpdHRlci10d2VldCcpO1xuICAgICAgaWYgKHR3ZWV0cy5sZW5ndGggPiAwKSB0aGlzLmRyYXdUd2l0dGVyVHdlZXRzKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuT3B0aW9ucy5TaG93RmFjZWJvb2tQb3N0cykge1xuICAgICAgdmFyIGZhY2VQb3N0cyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2ZhY2Vib29rLXBvc3QnKTtcbiAgICAgIGlmIChmYWNlUG9zdHMubGVuZ3RoID4gMCkgdGhpcy5kcmF3RmFjZWJvb2tQb3N0cygpO1xuICAgIH1cbiAgfTtcblxuICAvLyBEcmF3IFR3aXR0ZXIgRW1iZWRzXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLmRyYXdUd2l0dGVyVHdlZXRzID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0eXBlb2YgdHd0dHIgIT09ICd1bmRlZmluZWQnICYmIHR3dHRyICE9PSBudWxsICYmIHR5cGVvZiB0d3R0ci53aWRnZXRzICE9PSAndW5kZWZpbmVkJyAmJiB0d3R0ci53aWRnZXRzICE9PSBudWxsKSB7XG4gICAgICB0d3R0ci53aWRnZXRzLmxvYWQoKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gRHJhdyBGYWNlYm9vayBQb3N0c1xuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5kcmF3RmFjZWJvb2tQb3N0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodHlwZW9mIEZCICE9PSAndW5kZWZpbmVkJyAmJiBGQiAhPT0gbnVsbCAmJiB0eXBlb2YgRkIuWEZCTUwgIT09ICd1bmRlZmluZWQnICYmIEZCLlhGQk1MICE9PSBudWxsKSB7XG4gICAgICBGQi5YRkJNTC5wYXJzZSgpO1xuICAgIH1cbiAgfTtcblxuICAvLyBBZGQgdGhlIExvYWQgTW9yZSBCdG4gbGlzdGVuZXJcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZHJhd0xvYWRNb3JlQnRuID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsb2FkTW9yZVBhcmVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNzY3JpYmJsZS1saXZlLXdpZGdldCcpO1xuICAgIHZhciBsb2FkTW9yZUJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgbG9hZE1vcmVCdG4uaWQgPSAnc2NyaWJibGUtbG9hZC1tb3JlJztcbiAgICBsb2FkTW9yZUJ0bi5jbGFzc05hbWUgPSAnc2NyaWJibGUtbG9hZC1tb3JlJztcbiAgICBsb2FkTW9yZUJ0bi5pbm5lckhUTUwgPSAnRXhpYmlyIE1haXMgPGk+PC9pPic7XG5cbiAgICBpZih0aGlzLnRvdGFsUGFnZXMgPD0gMSl7IGxvYWRNb3JlQnRuLmRpc2FibGVkID0gdHJ1ZTsgfVxuXG4gICAgbG9hZE1vcmVQYXJlbnQuYXBwZW5kQ2hpbGQobG9hZE1vcmVCdG4pO1xuXG4gICAgdGhpcy5sb2FkTW9yZUJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY3JpYmJsZS1sb2FkLW1vcmUnKTtcbiAgICB0aGlzLmxvYWRNb3JlQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5nZXRPbGRlclBvc3RzKCk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gVGhlIGZ1bmN0aW9uIHRoYXQgYWRkcyBpbWFnZXMsIHZpZGVvLCBhbmQgYXVkaW8gdG8gcG9zdHMgY29udGFpbmluZyBtZWRpYSB0aGF0IGFyZSBhZGRlZCBvciBlZGl0ZWQuXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLmFkZE1lZGlhID0gZnVuY3Rpb24gKHBQb3N0KSB7XG4gICAgdmFyIE1lZGlhID0gcFBvc3QuTWVkaWE7XG4gICAgdmFyIE1lZGlhSHRtbDtcblxuICAgIGlmIChwUG9zdC5UeXBlID09PSBcIklNQUdFXCIgJiYgTWVkaWEuVHlwZSA9PT0gXCJJTUFHRVwiKSB7XG4gICAgICBNZWRpYUh0bWwgPSBcIjxpbWcgc3JjPSdcIiArIE1lZGlhLlVybCArIFwiJy8+XCI7XG4gICAgfVxuICAgIGlmIChwUG9zdC5UeXBlID09PSBcIlZJREVPXCIgJiYgTWVkaWEuVHlwZSA9PT0gXCJWSURFT1wiKSB7XG4gICAgICBNZWRpYUh0bWwgPSBcIjxlbWJlZCB0eXBlPSdhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaCcgc3JjPScvL2VtYmVkLnNjcmliYmxlbGl2ZS5jb20vanMvandmbHZwbGF5ZXIvcGxheWVyLWxpY2Vuc2VkLnN3Zj9UaHJlYWRJZD1cIiArIHRoaXMuT3B0aW9ucy5FdmVudElkICsgXCInIGZsYXNodmFycz0nZmlsZT1cIiArIE1lZGlhLlVybCArIFwiJz5cIjtcbiAgICB9XG4gICAgaWYgKHBQb3N0LlR5cGUgPT09IFwiQVVESU9cIiAmJiBNZWRpYS5UeXBlID09PSBcIkFVRElPXCIpIHtcbiAgICAgIE1lZGlhSHRtbCA9IFwiPGVtYmVkIGhlaWdodD0nMjAnIHdpZHRoPSczMDAnIHR5cGU9J2FwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoJyBzcmM9Jy8vZW1iZWQuc2NyaWJibGVsaXZlLmNvbS9qcy9qd2ZsdnBsYXllci9wbGF5ZXItbGljZW5zZWQuc3dmP1RocmVhZElkPVwiICsgdGhpcy5PcHRpb25zLkV2ZW50SWQgKyBcIicgZmxhc2h2YXJzPSdmaWxlPVwiICsgTWVkaWEuVXJsICsgXCInPlwiO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgY2FwdGlvbiB0byB0aGUgbWVkaWEgYWRkZWQgYWJvdmUuXG4gICAgdmFyIG5ld0NvbnRlbnQ7XG4gICAgaWYgKChwUG9zdC5Db250ZW50ICE9PSAnJykgJiYgKHBQb3N0LkNvbnRlbnQgIT09IHVuZGVmaW5lZCkgJiYgKHRoaXMuT3B0aW9ucy5TaG93Q2FwdGlvbnMpKSB7XG4gICAgICB2YXIgTWVkaWFDYXB0aW9uID0gXCI8cCBjbGFzcz0nQ2FwdGlvbic+XCIgKyBwUG9zdC5Db250ZW50ICsgXCI8L3A+XCI7XG4gICAgICBuZXdDb250ZW50ID0gTWVkaWFIdG1sICsgTWVkaWFDYXB0aW9uO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXdDb250ZW50ID0gTWVkaWFIdG1sO1xuICAgIH1cblxuICAgIHJldHVybiBuZXdDb250ZW50O1xuICB9O1xuXG4gIC8vIFRoZSBmdW5jdGlvbiB0aGF0IGFkZHMgYSBwb3N0LlxuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5idWlsZFBvc3QgPSBmdW5jdGlvbiAocFBvc3QsIHBQb3N0TGlzdCwgdHlwZSkge1xuICAgIC8vIEEgaHVnZSBpZiBzdGF0ZW1lbnQgdGhhdCBkZWNpZGVzIGlmIGl0IHNob3VsZCBiZSBzaG93aW5nIGEgcG9zdCBvciBub3QgYmFzZWQgb24gdGhlIG9wdGlvbnMgc2V0IHdoZW4gdGhlIHdpZGdldCBpcyBsb2FkZWQuXG4gICAgaWYgKFxuICAgICAgKHBQb3N0LlR5cGUgPT09IFwiSU1BR0VcIiAmJiAhdGhpcy5PcHRpb25zLlNob3dJbWFnZXMpIHx8XG4gICAgICAocFBvc3QuVHlwZSA9PT0gXCJWSURFT1wiICYmICF0aGlzLk9wdGlvbnMuU2hvd1ZpZGVvcykgfHxcbiAgICAgIChwUG9zdC5UeXBlID09PSBcIkFVRElPXCIgJiYgIXRoaXMuT3B0aW9ucy5TaG93QXVkaW8pIHx8XG4gICAgICAocFBvc3QuSXNTdHVjayA9PT0gMSAmJiAhdGhpcy5PcHRpb25zLlNob3dTdHVja1Bvc3RzKSB8fFxuICAgICAgKHBQb3N0LlR5cGUgPT09IFwiVEVYVFwiICYmICF0aGlzLk9wdGlvbnMuU2hvd1RleHRQb3N0cykgfHxcbiAgICAgIChwUG9zdC5Jc0NvbW1lbnQgPT09IDEgJiYgIXRoaXMuT3B0aW9ucy5TaG93Q29tbWVudHMpIHx8XG4gICAgICAocFBvc3QuSXNDb21tZW50ID09PSAwICYmICF0aGlzLk9wdGlvbnMuU2hvd09mZmljaWFsUG9zdHMpIHx8XG4gICAgICAocFBvc3QuU291cmNlLm1hdGNoKFwidHdpdHRlclwiKSAmJiAhdGhpcy5PcHRpb25zLlNob3dUd2l0dGVyVHdlZXRzKSB8fFxuICAgICAgKCFwUG9zdC5Tb3VyY2UubWF0Y2goXCJ0d2l0dGVyXCIpICYmIHRoaXMuT3B0aW9ucy5TaG93T25seVR3ZWV0cykgfHxcbiAgICAgICgocFBvc3QuU291cmNlLm1hdGNoKFwibW9iaWxlXCIpIHx8IHBQb3N0LlNvdXJjZS5tYXRjaChcIlNNU1wiKSkgJiYgIXRoaXMuT3B0aW9ucy5TaG93TW9iaWxlUG9zdHMpIHx8XG4gICAgICAocFBvc3QuU291cmNlLm1hdGNoKFwid3d3LmZhY2Vib29rLmNvbVwiKSAmJiAhdGhpcy5PcHRpb25zLlNob3dGYWNlYm9va1Bvc3RzKSB8fFxuICAgICAgKCFwUG9zdC5Tb3VyY2UubWF0Y2goXCJ3d3cuZmFjZWJvb2suY29tXCIpICYmIHRoaXMuT3B0aW9ucy5TaG93T25seUZhY2Vib29rUG9zdHMpXG4gICAgKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHBvc3QgeW91IGFyZSB0cnlpbmcgdG8gYWRkIGlzIGFscmVhZHkgb24gdGhlIHBhZ2UsIHN0b3AgdHJ5aW5nIHRvIGFkZCBpdC5cbiAgICBmb3IgKHZhciBjID0gMDsgYyA8IHBQb3N0TGlzdC5sZW5ndGg7IGMrKykge1xuICAgICAgaWYgKHBQb3N0LklkID09PSBwYXJzZUludChwUG9zdExpc3RbY10pKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBHZXQgbmV3IHBvc3QgdHlwZVxuICAgIHZhciBuZXdQb3N0VHlwZSA9ICh0eXBlb2YgcFBvc3QuUG9zdE1ldGEuVHlwZSAhPT0gJ3VuZGVmaW5lZCcpID8gcFBvc3QuUG9zdE1ldGEuVHlwZSA6ICdzY3JpYmJsZTpwb3N0JztcblxuICAgIC8vIENyZWF0ZSBhIG5ldyBsaXN0IGl0ZW0gd2l0aCB0aGUgcG9zdCBpZCBhcyB0aGUgaWQgYXR0cmlidXRlLlxuICAgIHZhciBuZXdMaXN0SXRlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcbiAgICBuZXdMaXN0SXRlbS5pZCA9IHBQb3N0LklkO1xuICAgIG5ld0xpc3RJdGVtLmNsYXNzTmFtZSA9IHRoaXMuT3B0aW9ucy5JdGVtQ2xhc3M7XG4gICAgaWYgKHBQb3N0LlJhbmsgPT09IDApIHsgbmV3TGlzdEl0ZW0uY2xhc3NOYW1lICs9IFwiIHBpbm5lZFwiOyB9XG5cbiAgICAvLyBDcmVhdGUgaXRlbSB0aW1lbGluZVxuICAgIHZhciBuZXdJdGVtVGltZWxpbmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGltZVwiKTtcbiAgICBuZXdJdGVtVGltZWxpbmUuY2xhc3NOYW1lID0gdGhpcy5PcHRpb25zLkl0ZW1UaW1lbGluZUNsYXNzO1xuICAgIG5ld0l0ZW1UaW1lbGluZS5pbm5lckhUTUwgPSB0aGlzLmdldFRpbWVTaW5jZShuZXcgRGF0ZShwUG9zdC5MYXN0TW9kaWZpZWREYXRlKSk7XG5cbiAgICAvLyBDcmVhdGUgaXRlbSBjb250YWluZXJcbiAgICB2YXIgbmV3SXRlbUNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgbmV3SXRlbUNvbnRhaW5lci5jbGFzc05hbWUgPSB0aGlzLk9wdGlvbnMuSXRlbUNvbnRhaW5lckNsYXNzO1xuXG4gICAgLy8gQ3JlYXRlIGEgZGl2IHdpdGggYSBjbGFzcyBvZiBDb250ZW50IHRoYXQgY29udGFpbnMgdGhlIHBvc3QgY29udGVudC5cbiAgICB2YXIgbmV3Q29udGVudERpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgbmV3Q29udGVudERpdi5jbGFzc05hbWUgPSB0aGlzLk9wdGlvbnMuSXRlbUNvbnRlbnRDbGFzcztcblxuICAgIGlmIChuZXdQb3N0VHlwZSA9PT0gXCJzY3JpYmJsZTpwb3N0XCIpIHtcbiAgICAgIC8vIENyZWF0ZSBpdGVtIGRlY2tcbiAgICAgIHZhciBuZXdJdGVtRGVjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICBuZXdJdGVtRGVjay5jbGFzc05hbWUgPSB0aGlzLk9wdGlvbnMuSXRlbURlY2tDbGFzcztcblxuICAgICAgLy8gSWYgdGhlcmUgaXMgYW4gYXZhdGFyIGFzc29jaWF0ZWQgd2l0aCB0aGUgY3JlYXRvciBvZiB0aGUgcG9zdCwgY3JlYXRlIGFuIGltYWdlIHRhZyB3aXRoIHRoZSBhdmF0YXIgdXJsIGFzIHRoZSBzcmMgYXR0cmlidXRlLlxuICAgICAgdmFyIG5ld0l0ZW1BdmF0YXJJbWFnZTtcbiAgICAgIGlmIChwUG9zdC5DcmVhdG9yLkF2YXRhciAhPT0gJycgJiYgdGhpcy5PcHRpb25zLlNob3dBdmF0YXJzKSB7XG4gICAgICAgIG5ld0l0ZW1BdmF0YXJJbWFnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbWdcIik7XG4gICAgICAgIG5ld0l0ZW1BdmF0YXJJbWFnZS5zcmMgPSBwUG9zdC5DcmVhdG9yLkF2YXRhcjtcbiAgICAgICAgbmV3SXRlbUF2YXRhckltYWdlLmNsYXNzTmFtZSA9IHRoaXMuT3B0aW9ucy5JdGVtQXZhdGFySW1hZ2VDbGFzcztcbiAgICAgIH1cbiAgICAgIGlmIChuZXdJdGVtQXZhdGFySW1hZ2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBuZXdJdGVtRGVjay5hcHBlbmRDaGlsZChuZXdJdGVtQXZhdGFySW1hZ2UpO1xuICAgICAgfVxuXG4gICAgICAvLyBDcmVhdGUgaXRlbSBhdXRob3IgbmFtZS4gSWYgdGhlIHNvdXJjZSBpcyBhIHNvY2lhbCBuZXR3b3JrLCBhZGQgYSBsaW5rIHRvIHRoZSBzb2NpYWwgbmV0d29yayBhY2NvdW50LlxuICAgICAgdmFyIG5ld0l0ZW1BdXRob3JOYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgIG5ld0l0ZW1BdXRob3JOYW1lLmNsYXNzTmFtZSA9IHRoaXMuT3B0aW9ucy5JdGVtQXZhdGFyTmFtZUNsYXNzO1xuICAgICAgbmV3SXRlbUF1dGhvck5hbWUuaW5uZXJIVE1MID0gcFBvc3QuQ3JlYXRvci5OYW1lO1xuICAgICAgbmV3SXRlbURlY2suYXBwZW5kQ2hpbGQobmV3SXRlbUF1dGhvck5hbWUpO1xuXG4gICAgICAvLyBDcmVhdGUgaXRlbSBkZWNrIHRpbWVcbiAgICAgIHZhciBuZXdJdGVtRGVja1RpbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgbmV3SXRlbURlY2tUaW1lLmNsYXNzTmFtZSA9IHRoaXMuT3B0aW9ucy5JdGVtRGVja1RpbWVDbGFzcztcbiAgICAgIG5ld0l0ZW1EZWNrVGltZS5pbm5lckhUTUwgPSB0aGlzLmdldFRpbWVTaW5jZShuZXcgRGF0ZShwUG9zdC5MYXN0TW9kaWZpZWREYXRlKSk7XG4gICAgICBuZXdJdGVtRGVjay5hcHBlbmRDaGlsZChuZXdJdGVtRGVja1RpbWUpO1xuXG4gICAgICBuZXdJdGVtQ29udGFpbmVyLmFwcGVuZENoaWxkKG5ld0l0ZW1EZWNrKTtcbiAgICAgIG5ld0NvbnRlbnREaXYuaW5uZXJIVE1MID0gcFBvc3QuQ29udGVudDtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgcG9zdCBpcyBhIGZhY2Vib29rOnBvc3QuXG4gICAgZWxzZSBpZiAobmV3UG9zdFR5cGUgPT09IFwiZmFjZWJvb2s6cG9zdFwiKSB7XG4gICAgICB2YXIgZmFjZWJvb2tFbWJlZCA9IHBQb3N0LkNvbnRlbnQ7XG4gICAgICB2YXIgZmFjZWJvb2tFbWJlZFdpZHRoID0gdGhpcy5jdXJyZW50RGV2aWNlID09PSAnbW9iaWxlJyA/ICdhdXRvJyA6ICc1NzUnO1xuICAgICAgZmFjZWJvb2tFbWJlZCA9IGZhY2Vib29rRW1iZWQucmVwbGFjZSgnZGF0YS13aWR0aD1cIjUwMFwiJywgJ2RhdGEtd2lkdGg9XCInICsgZmFjZWJvb2tFbWJlZFdpZHRoICsgJ1wiJyk7XG4gICAgICBuZXdDb250ZW50RGl2LmNsYXNzTmFtZSArPSBcIiBmYWNlYm9vay1wb3N0XCI7XG4gICAgICBuZXdDb250ZW50RGl2LmlubmVySFRNTCA9IGZhY2Vib29rRW1iZWQ7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHBvc3QgaXMgYSB0d2l0dGVyOnR3ZWV0LlxuICAgIGVsc2UgaWYgKG5ld1Bvc3RUeXBlID09PSBcInR3aXR0ZXI6dHdlZXRcIikge1xuICAgICAgdmFyIHR3aXR0ZXJFbWJlZCA9ICc8YmxvY2txdW90ZSBjbGFzcz1cInR3aXR0ZXItdHdlZXQgdHdpdHRlci1ibG9ja3F1b3RlXCI+JyArIHBQb3N0LlNvdXJjZSArICc8L2Jsb2NrcXVvdGU+JztcbiAgICAgIG5ld0NvbnRlbnREaXYuY2xhc3NOYW1lICs9IFwiIHR3aXR0ZXItdHdlZXRcIjtcbiAgICAgIG5ld0NvbnRlbnREaXYuaW5uZXJIVE1MID0gdHdpdHRlckVtYmVkO1xuICAgIH1cblxuICAgIC8vIFRPIERPOiBJZiB0aGUgcG9zdCBpcyBhIGluc3RhZ3JhbTpwb3N0LlxuICAgIC8vIGVsc2UgaWYgKG5ld1Bvc3RUeXBlID09PSBcImluc3RhZ3JhbTpwb3N0XCIpIHtcbiAgICAvLyAgIG5ld0NvbnRlbnREaXYuaW5uZXJIVE1MID0gcFBvc3QuQ29udGVudDtcbiAgICAvLyB9XG5cbiAgICBlbHNlIGlmIChuZXdQb3N0VHlwZSA9PT0gXCJ5b3V0dWJlOnBvc3RcIikge1xuICAgICAgdmFyIHlvdXR1YmVFbWJlZCA9IHBQb3N0LkNvbnRlbnQ7XG4gICAgICB2YXIgeW91dHViZUVtYmVkSGVpZ3RoID0gdGhpcy5jdXJyZW50RGV2aWNlID09PSAnbW9iaWxlJyA/ICdhdXRvJyA6ICc0MjAnO1xuICAgICAgeW91dHViZUVtYmVkID0geW91dHViZUVtYmVkLnJlcGxhY2UoJ3dpZHRoPVwiNTAwXCIgaGVpZ2h0PVwiMzAwXCInLCAnd2lkdGg9XCIxMDAlXCIgaGVpZ2h0PVwiJyArIHlvdXR1YmVFbWJlZEhlaWd0aCArICdcIicpO1xuICAgICAgbmV3Q29udGVudERpdi5jbGFzc05hbWUgKz0gXCIgeW91dHViZS1wb3N0XCI7XG4gICAgICBuZXdDb250ZW50RGl2LmlubmVySFRNTCA9IHlvdXR1YmVFbWJlZDtcbiAgICB9XG5cbiAgICBlbHNlIGlmIChwUG9zdC5NZWRpYSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBuZXdDb250ZW50RGl2LmlubmVySFRNTCA9IHRoaXMuYWRkTWVkaWEocFBvc3QpO1xuICAgIH1cblxuICAgIC8vIEFkZCBhbnkgaW1hZ2UsIHZpZGVvLCBvciBhdWRpbyB0byB0aGUgcG9zdCBjb250ZW50IGRpdi5cbiAgICBlbHNlIGlmIChwUG9zdC5NZWRpYSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBuZXdDb250ZW50RGl2LmlubmVySFRNTCA9IHRoaXMuYWRkTWVkaWEocFBvc3QpO1xuICAgIH1cblxuICAgIC8vIFNpdGUgcHJldmlld1xuICAgIGVsc2UgaWYgKHBQb3N0LkNvbnRlbnQuaW5kZXhPZignc2NyYmJsLXNpdGVQcmV2aWV3JykgIT09IC0xKSB7XG4gICAgICBuZXdDb250ZW50RGl2LmNsYXNzTmFtZSArPSBcIiBzaXRlLXByZXZpZXdcIjtcbiAgICAgIG5ld0NvbnRlbnREaXYuaW5uZXJIVE1MID0gcFBvc3QuQ29udGVudDtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIHJlZ3VsYXIgY29udGVudC5cbiAgICBlbHNlIHtcbiAgICAgIG5ld0NvbnRlbnREaXYuaW5uZXJIVE1MID0gcFBvc3QuQ29udGVudDtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIGl0ZW0gZGVjayBhbmQgaXRlbSBjb250ZW50IHRvIHRoZSBpdGVtIGNvbnRhaW5lciBkaXYuXG4gICAgbmV3SXRlbUNvbnRhaW5lci5hcHBlbmRDaGlsZChuZXdDb250ZW50RGl2KTtcblxuICAgIC8vIEFkZCB0aGUgdGltZWxpbmUgYW5kIHRoZSBjb250YWluZXIgZGl2IHRvIHRoZSBsaXN0IGl0ZW0uXG4gICAgbmV3TGlzdEl0ZW0uYXBwZW5kQ2hpbGQobmV3SXRlbVRpbWVsaW5lKTtcbiAgICBuZXdMaXN0SXRlbS5hcHBlbmRDaGlsZChuZXdJdGVtQ29udGFpbmVyKTtcblxuICAgIHZhciBwaW5uZWRMaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodGhpcy5PcHRpb25zLlBpbm5lZExpc3RDbGFzcyk7XG4gICAgdmFyIHJlZ3VsYXJMaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodGhpcy5PcHRpb25zLlJlZ3VsYXJMaXN0Q2xhc3MpO1xuXG4gICAgLy8gUnVsZXMgZm9yIGRlZmF1bHQgbmV3IHBvc3RzXG4gICAgaWYgKHR5cGUgPT09ICdSRUNFTlQnKSB7XG5cbiAgICAgIC8vIFBpbm5lZCBQb3N0c1xuICAgICAgaWYgKHBQb3N0LlJhbmsgPT09IDApIHtcbiAgICAgICAgdGhpcy5hcHBlbmROb2RlKG5ld0xpc3RJdGVtLCBwaW5uZWRMaXN0LCAodGhpcy5maXJzdFJlbmRlciA/ICdib3R0b20nIDogJ3RvcCcpKTtcblxuICAgICAgLy8gUmVndWxhciBQb3N0c1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5hcHBlbmROb2RlKG5ld0xpc3RJdGVtLCByZWd1bGFyTGlzdCwgKHRoaXMuZmlyc3RSZW5kZXIgPyAnYm90dG9tJyA6ICd0b3AnKSk7XG4gICAgICB9XG5cbiAgICAvLyBSdWxlcyBmb3IgbG9hZC1tb3JlIG9sZGVyIHBvc3RzXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnT0xERVInKSB7XG5cbiAgICAgIGlmICh0aGlzLmFkZGVkUG9zdHMgPCB0aGlzLk9wdGlvbnMuUG9zdHNQZXJQYWdlKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kTm9kZShuZXdMaXN0SXRlbSwgcmVndWxhckxpc3QsICdib3R0b20nKTtcbiAgICAgICAgdGhpcy5hZGRlZFBvc3RzKys7XG4gICAgICAgIHRoaXMuYWRkZWRQb3N0c0N1cnJlbnQrKztcbiAgICAgIH1cblxuICAgICAgLy8gT25seSBpbmNyZW1lbnRzIHRoZSBwYWdlIHdoZW4gYWxsIHBvc3RzIGluIHRoZSBwYWdlIGhhdmUgYWxyZWFkeSBiZWVuIGxvYWRlZFxuICAgICAgaWYgKHRoaXMuYWRkZWRQb3N0c0N1cnJlbnQgPT09IHRoaXMuT3B0aW9ucy5Qb3N0c1BlclBhZ2UpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50UGFnZSsrO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvLyBUaGUgZnVuY3Rpb24gdGhhdCBkZWxldGVzIGEgcG9zdC5cbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZGVsZXRlUG9zdCA9IGZ1bmN0aW9uIChwUG9zdElkKSB7XG4gICAgdmFyIHBvc3RUb0RlbGV0ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHBQb3N0SWQpO1xuXG4gICAgaWYgKHBvc3RUb0RlbGV0ZSAhPT0gbnVsbCkge1xuICAgICAgcG9zdFRvRGVsZXRlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQocG9zdFRvRGVsZXRlKTtcbiAgICB9XG5cbiAgICB0aGlzLmN1cnJlbnRQb3N0c0xpc3QgPSB0aGlzLmdldFBvc3RMaXN0KCk7XG4gIH07XG5cbiAgLy8gVGhlIGZ1bmN0aW9uIHRoYXQgZWRpdHMgYSBwb3N0IGJ5IGZpbmRpbmcgdGhlIG1hdGNoaW5nIHBvc3QgaWQgYW5kIHJlcGxhY2luZyB0aGUgQ29udGVudCBkaXYgaHRtbC5cbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZWRpdFBvc3QgPSBmdW5jdGlvbiAocFBvc3RUb0VkaXQpIHtcbiAgICB2YXIgcG9zdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHBQb3N0VG9FZGl0LklkKTtcbiAgICB2YXIgcG9zdEVsZW1lbnRzID0gcG9zdC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImRpdlwiKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBvc3RFbGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHBvc3RFbGVtZW50c1tpXS5jbGFzc05hbWUuaW5kZXhPZihzZWxmLk9wdGlvbnMuSXRlbUNvbnRlbnRDbGFzcykgIT09IC0xKSB7XG4gICAgICAgIGlmIChwUG9zdFRvRWRpdC5NZWRpYSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcG9zdEVsZW1lbnRzW2ldLmlubmVySFRNTCA9IHRoaXMuYWRkTWVkaWEocFBvc3RUb0VkaXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBvc3RFbGVtZW50c1tpXS5pbm5lckhUTUwgPSBwUG9zdFRvRWRpdC5Db250ZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUGluIC8gVW5waW4gcG9zdHNcbiAgICAgICAgaWYgKHBQb3N0VG9FZGl0LlJhbmsgPT09IDAgJiYgcG9zdC5wYXJlbnRFbGVtZW50LmlkID09PSB0aGlzLk9wdGlvbnMuUmVndWxhckxpc3RDbGFzcykge1xuICAgICAgICAgIHRoaXMucGluUG9zdChwUG9zdFRvRWRpdCk7XG5cbiAgICAgICAgfSBlbHNlIGlmKHBQb3N0VG9FZGl0LlJhbmsgPT09IDEgJiYgcG9zdC5wYXJlbnRFbGVtZW50LmlkID09PSB0aGlzLk9wdGlvbnMuUGlubmVkTGlzdENsYXNzKSB7XG4gICAgICAgICAgdGhpcy51bnBpblBvc3QocFBvc3RUb0VkaXQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIC8vIFBpbm4gLyBVbnBpbm4gcG9zdHNcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUucGluUG9zdCA9IGZ1bmN0aW9uIChwUG9zdFRvUGluKSB7XG4gICAgdGhpcy5kZWxldGVQb3N0KHBQb3N0VG9QaW4uSWQpO1xuICAgIHRoaXMuYnVpbGRQb3N0KHBQb3N0VG9QaW4sIHRoaXMuY3VycmVudFBvc3RzTGlzdCwgJ1JFQ0VOVCcpO1xuICB9O1xuXG4gIC8vIFBpbm4gLyBVbnBpbm4gcG9zdHNcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUudW5waW5Qb3N0ID0gZnVuY3Rpb24gKHBQb3N0VG9VbnBpbikge1xuICAgIHRoaXMuZGVsZXRlUG9zdChwUG9zdFRvVW5waW4uSWQpO1xuICAgIHRoaXMuYnVpbGRQb3N0KHBQb3N0VG9VbnBpbiwgdGhpcy5jdXJyZW50UG9zdHNMaXN0LCAnUkVDRU5UJyk7XG4gIH07XG5cbiAgLy8gQXBwZW5kIGl0ZW5zIGluIHRoZSBkb20gdHJlZVxuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5hcHBlbmROb2RlID0gZnVuY3Rpb24gKHBvc3QsIGxpc3QsIHBvcykge1xuICAgIHZhciBwb3NpdGlvbiA9ICh0eXBlb2YgcG9zID09PSAndW5kZWZpbmVkJykgPyAndG9wJyA6IHBvcztcblxuICAgIGlmIChwb3NpdGlvbiA9PT0gJ3RvcCcpIHtcbiAgICAgIGxpc3QuaW5zZXJ0QmVmb3JlKHBvc3QsIGxpc3QuZmlyc3RDaGlsZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3QuYXBwZW5kQ2hpbGQocG9zdCk7XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50UG9zdHNMaXN0ID0gdGhpcy5nZXRQb3N0TGlzdCgpO1xuICB9O1xuXG4gIC8vIElmIHRoZXJlIGFyZSBlZGl0ZWQgcG9zdHMsIGVkaXQgdGhlbSBpZiB0aGV5IGFyZSBvbiB0aGUgcGFnZSAoY29tcGFyZSBpZHMpIGFuZCBoYXZlbid0IGFscmVhZHkgYmVlbiBlZGl0ZWQgKGNvbXBhcmUgbGFzdCBtb2RpZmllZCB0aW1lcykuXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLnNob3VsZFBvc3RVcGRhdGUgPSBmdW5jdGlvbiAocFBvc3QpIHtcbiAgICB2YXIgdXBkYXRlID0gZmFsc2U7XG5cbiAgICBmb3IgKHZhciBiID0gMDsgYiA8IHRoaXMuY3VycmVudFBvc3RzTGlzdC5sZW5ndGg7IGIrKykge1xuICAgICAgdmFyIFBvc3RMYXN0TW9kaWZpZWQgPSBNYXRoLnJvdW5kKG5ldyBEYXRlKHBQb3N0Lkxhc3RNb2RpZmllZERhdGUpLmdldFRpbWUoKSAvIDEwMDAuMCk7XG5cbiAgICAgIGlmIChwUG9zdC5JZCA9PT0gcGFyc2VJbnQodGhpcy5jdXJyZW50UG9zdHNMaXN0W2JdKSAmJiBQb3N0TGFzdE1vZGlmaWVkID4gdGhpcy5sYXN0TW9kaWZpZWRUaW1lKSB7XG4gICAgICAgIHVwZGF0ZSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHVwZGF0ZTtcbiAgfTtcblxuICAvLyBBZGQgYW4gZW1wdHkgbGlzdCB0byB0aGUgZWxlbWVudCBzcGVjaWZpZWQgaW4gdGhlIHNldHVwIGF0IHRoZSB0b3Agb2YgdGhpcyBzY3JpcHQuXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLmNyZWF0ZVBvc3RMaXN0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB3aWRnZXREaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHdpZGdldERpdi5zZXRBdHRyaWJ1dGUoXCJpZFwiLCB0aGlzLk9wdGlvbnMuV2lkZ2V0Q2xhc3MpO1xuICAgIHdpZGdldERpdi5jbGFzc05hbWUgPSB0aGlzLk9wdGlvbnMuV2lkZ2V0Q2xhc3M7XG5cbiAgICB2YXIgcGlubmVkTGlzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ1bFwiKTtcbiAgICBwaW5uZWRMaXN0LnNldEF0dHJpYnV0ZShcImlkXCIsIHRoaXMuT3B0aW9ucy5QaW5uZWRMaXN0Q2xhc3MpO1xuICAgIHBpbm5lZExpc3QuY2xhc3NOYW1lID0gdGhpcy5PcHRpb25zLlBpbm5lZExpc3RDbGFzcyArIFwiIFwiICsgdGhpcy5PcHRpb25zLkl0ZW5zTGlzdENsYXNzO1xuXG4gICAgdmFyIHJlZ3VsYXJMaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInVsXCIpO1xuICAgIHJlZ3VsYXJMaXN0LnNldEF0dHJpYnV0ZShcImlkXCIsIHRoaXMuT3B0aW9ucy5SZWd1bGFyTGlzdENsYXNzKTtcbiAgICByZWd1bGFyTGlzdC5jbGFzc05hbWUgPSB0aGlzLk9wdGlvbnMuUmVndWxhckxpc3RDbGFzcyArIFwiIFwiICsgdGhpcy5PcHRpb25zLkl0ZW5zTGlzdENsYXNzO1xuXG4gICAgd2lkZ2V0RGl2LmFwcGVuZENoaWxkKHBpbm5lZExpc3QpO1xuICAgIHdpZGdldERpdi5hcHBlbmRDaGlsZChyZWd1bGFyTGlzdCk7XG5cbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh0aGlzLk9wdGlvbnMuV2hlcmVUb0FkZFBvc3RzKS5hcHBlbmRDaGlsZCh3aWRnZXREaXYpO1xuICB9O1xuXG4gIC8vIENyZWF0ZSBhIGxpc3Qgb2YgcG9zdHMgY3VycmVudGx5IG9uIHRoZSBwYWdlIGJ5IGZpbmRpbmcgYWxsIGxpc3QgaXRlbXMgaW5zaWRlIHRoZSBzY3JpYmJsZS1wb3N0cy1saXN0IGxpc3QgYW5kIGFkZGluZyB0aGVpciBpZHMgdG8gYW4gYXJyYXkuXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLmdldFBvc3RMaXN0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBjdXJyZW50UG9zdHNMaXN0ID0gW107XG4gICAgdmFyIEN1cnJlbnRQb3N0cyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHRoaXMuT3B0aW9ucy5XaWRnZXRDbGFzcykuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJsaVwiKTtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IEN1cnJlbnRQb3N0cy5sZW5ndGg7IGorKykge1xuICAgICAgY3VycmVudFBvc3RzTGlzdC5wdXNoKEN1cnJlbnRQb3N0c1tqXS5nZXRBdHRyaWJ1dGUoXCJpZFwiKSk7XG4gICAgfVxuICAgIHJldHVybiBjdXJyZW50UG9zdHNMaXN0O1xuICB9O1xuXG4gIC8vIFRoZSBpbml0aWFsIEFQSSBjYWxsIHRoYXQgZ2V0cyBhbGwgb2YgdGhlIG1vc3QgcmVjZW50IHBvc3RzIGFuZCBmZWVkcyB0aGVtIGJhY2sgaW50byB0aGlzIHNjcmlwdC5cbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZ2V0QWxsUG9zdHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlcXVlc3RVcmwgPSB0aGlzLmhvc3RuYW1lICsgXCJzdHJlYW0vXCIgKyB0aGlzLk9wdGlvbnMuRXZlbnRJZCArIFwiL3Bvc3RzP1BhZ2VOdW1iZXI9XCIgKyB0aGlzLmN1cnJlbnRQYWdlICsgXCImUGFnZVNpemU9XCIgKyB0aGlzLk9wdGlvbnMuUG9zdHNQZXJQYWdlICsgXCImVG9rZW49XCIgKyB0aGlzLk9wdGlvbnMuQVBJVG9rZW47XG4gICAgdGhpcy5yZXF1ZXN0QVBJKCdHRVQnLCByZXF1ZXN0VXJsLCB0aGlzLmRyYXdOZXdQb3N0cy5iaW5kKHRoaXMpKTtcbiAgfTtcblxuICAvLyBHZXQgbmV3IHBvc3RzLlxuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5nZXROZXdQb3N0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyB2YXIgcmVxdWVzdFVybCA9IHRoaXMuaG9zdG5hbWUgKyBcInN0cmVhbS9cIiArIHRoaXMuT3B0aW9ucy5FdmVudElkICsgXCIvcG9zdHMvc2luY2U/VGltZXN0YW1wPVwiICsgdGhpcy5sYXN0TW9kaWZpZWRUaW1lICtcIiZNYXg9XCIgKyB0aGlzLk9wdGlvbnMuUG9zdHNQZXJQYWdlICsgXCImSW5jbHVkZVN0cmVhbVN0YXR1cz10cnVlJlRva2VuPVwiICsgdGhpcy5PcHRpb25zLkFQSVRva2VuO1xuICAgIHZhciByZXF1ZXN0VXJsID0gdGhpcy5ob3N0bmFtZSArIFwic3RyZWFtL1wiICsgdGhpcy5PcHRpb25zLkV2ZW50SWQgKyBcIi9wb3N0cy9yZWNlbnQ/VGltZXN0YW1wPVwiICsgdGhpcy5sYXN0TW9kaWZpZWRUaW1lICsgXCImVG9rZW49XCIgKyB0aGlzLk9wdGlvbnMuQVBJVG9rZW47XG4gICAgY29uc29sZS5sb2coJ1tTY3JpYmJsZUxpdmVGZWVkXSBQb29saW5nIC0gTG9hZGluZyBuZXcgcG9zdHMgLi4uJyk7XG4gICAgdGhpcy5yZXF1ZXN0QVBJKCdHRVQnLCByZXF1ZXN0VXJsLCB0aGlzLmRyYXdOZXdQb3N0cy5iaW5kKHRoaXMpKTtcbiAgfTtcblxuICAvLyBQYWdpbmF0ZSB0aHJvdWdoIHRoZSBvbGRlc3QgcG9zdHNcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZ2V0T2xkZXJQb3N0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVxdWVzdFVybCA9IHRoaXMuaG9zdG5hbWUgKyBcInN0cmVhbS9cIiArIHRoaXMuT3B0aW9ucy5FdmVudElkICsgXCIvcG9zdHM/UGFnZU51bWJlcj1cIiArIHRoaXMuY3VycmVudFBhZ2UgKyBcIiZQYWdlU2l6ZT1cIiArIHRoaXMuT3B0aW9ucy5Qb3N0c1BlclBhZ2UgKyBcIiZUb2tlbj1cIiArIHRoaXMuT3B0aW9ucy5BUElUb2tlbjtcbiAgICB0aGlzLmxvYWRpbmdVcGRhdGUodHJ1ZSk7XG4gICAgdGhpcy5yZXF1ZXN0QVBJKCdHRVQnLCByZXF1ZXN0VXJsLCB0aGlzLmRyYXdPbGRlclBvc3RzLmJpbmQodGhpcykpO1xuICB9O1xuXG4gIC8vIEdlbmVyaWMgQUpBWCBNZXRob2RcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUucmVxdWVzdEFQSSA9IGZ1bmN0aW9uIChtZXRob2QsIHVybCwgY2FsbGJhY2spIHtcbiAgICB2YXIgeG1saHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHhtbGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHhtbGh0dHAucmVhZHlTdGF0ZSA9PT0gNCAmJiB4bWxodHRwLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgIGNhbGxiYWNrKEpTT04ucGFyc2UoeG1saHR0cC5yZXNwb25zZVRleHQpKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHhtbGh0dHAub25lcnJvciA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICBjb25zb2xlLmxvZygnW1NjcmliYmxlXSBFcnJvcicsIGUpO1xuICAgIH07XG4gICAgeG1saHR0cC5vcGVuKG1ldGhvZCwgdXJsLCB0cnVlKTtcbiAgICB4bWxodHRwLnNlbmQoKTtcbiAgfTtcblxuICAvLyBDYWxsIGFsbCBzcGVjaWZpYyBsb2FkIG1ldGhvZHNcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUubG9hZEV4dGVybmFsU2NyaXB0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5PcHRpb25zLlNob3dUd2l0dGVyVHdlZXRzKSB0aGlzLmxvYWRUd2l0dGVyU2NyaXB0cygpO1xuICAgIGlmICh0aGlzLk9wdGlvbnMuU2hvd0ZhY2Vib29rUG9zdHMpIHRoaXMubG9hZEZhY2Vib29rU2NyaXB0cygpO1xuXG4gICAgdGhpcy5sb2FkU2NyaWJibGVTY3JpcHRzKCk7XG4gIH07XG5cbiAgLy8gTG9hZCBTY3JpYmJsZSBzY3JpcHRzXG4gIFNjcmliYmxlTGl2ZUZlZWQucHJvdG90eXBlLmxvYWRTY3JpYmJsZVNjcmlwdHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgKGZ1bmN0aW9uICh3LCBkLCBlaWQsIHNlbGYpIHtcbiAgICAgIHZhciBpZCA9ICdzbC1saWJqcycsXG4gICAgICAgIHdoZXJlID0gZC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnc2NyaXB0JylbMF07XG5cbiAgICAgIGlmIChkLmdldEVsZW1lbnRCeUlkKGlkKSkgcmV0dXJuO1xuXG4gICAgICB3Ll9zbHEgPSB3Ll9zbHEgfHwgW107XG4gICAgICBfc2xxLnB1c2goWydfc2V0RXZlbnRJZCcsIGVpZF0pO1xuXG4gICAgICBqcyA9IGQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICBqcy5pZCA9IGlkO1xuICAgICAganMuYXN5bmMgPSB0cnVlO1xuICAgICAganMuc3JjID0gJy8vZW1iZWQuc2NyaWJibGVsaXZlLmNvbS9tb2R1bGVzL2xpYi9hZGRvbnMuanMnO1xuICAgICAgd2hlcmUucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoanMsIHdoZXJlKTtcbiAgICB9KHdpbmRvdywgZG9jdW1lbnQsIHRoaXMuT3B0aW9ucy5FdmVudElkLCB0aGlzKSk7XG4gIH07XG5cbiAgLy8gTG9hZCBUd2l0dGVyIHNjcmlwdHNcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUubG9hZFR3aXR0ZXJTY3JpcHRzID0gZnVuY3Rpb24gKCkge1xuICAgIHdpbmRvdy50d3R0ciA9IChmdW5jdGlvbiAoZCwgcywgaWQsIHNlbGYpIHtcbiAgICAgIHZhciBqcywgZmpzID0gZC5nZXRFbGVtZW50c0J5VGFnTmFtZShzKVswXSxcbiAgICAgICAgdCA9IHdpbmRvdy50d3R0ciB8fCB7fTtcbiAgICAgIGlmIChkLmdldEVsZW1lbnRCeUlkKGlkKSkgcmV0dXJuIHQ7XG4gICAgICBqcyA9IGQuY3JlYXRlRWxlbWVudChzKTtcbiAgICAgIGpzLmlkID0gaWQ7XG4gICAgICBqcy5zcmMgPSBcImh0dHBzOi8vcGxhdGZvcm0udHdpdHRlci5jb20vd2lkZ2V0cy5qc1wiO1xuICAgICAgZmpzLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGpzLCBmanMpO1xuICAgICAgdC5fZSA9IFtdO1xuICAgICAgdC5yZWFkeSA9IGZ1bmN0aW9uIChmKSB7XG4gICAgICAgIHQuX2UucHVzaChmKTtcbiAgICAgIH07XG4gICAgICByZXR1cm4gdDtcbiAgICB9KGRvY3VtZW50LCBcInNjcmlwdFwiLCBcInR3aXR0ZXItd2pzXCIsIHRoaXMpKTtcbiAgfTtcblxuICAvLyBMb2FkIEZhY2Vib29rIHNjcmlwdHNcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUubG9hZEZhY2Vib29rU2NyaXB0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZmJSb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBmYlJvb3QuaWQgPSBcImZiLXJvb3RcIjtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdib2R5JykuYXBwZW5kQ2hpbGQoZmJSb290KTtcbiAgICAoZnVuY3Rpb24gKGQsIHMsIGlkLCBzZWxmKSB7XG4gICAgICB2YXIganMsIGZqcyA9IGQuZ2V0RWxlbWVudHNCeVRhZ05hbWUocylbMF07XG4gICAgICBpZiAoZC5nZXRFbGVtZW50QnlJZChpZCkpIHJldHVybjtcbiAgICAgIGpzID0gZC5jcmVhdGVFbGVtZW50KHMpO1xuICAgICAganMuaWQgPSBpZDtcbiAgICAgIGpzLnNyYyA9IFwiLy9jb25uZWN0LmZhY2Vib29rLm5ldC9lbl9VUy9zZGsuanMjeGZibWw9MSZ2ZXJzaW9uPXYyLjdcIjtcbiAgICAgIGZqcy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShqcywgZmpzKTtcbiAgICB9KGRvY3VtZW50LCAnc2NyaXB0JywgJ2ZhY2Vib29rLWpzc2RrJywgdGhpcykpO1xuICB9O1xuXG4gIC8vIFVwZGF0ZSBMb2FkTW9yZSBCdG4gc3RhdGVcbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUubG9hZGluZ1VwZGF0ZSA9IGZ1bmN0aW9uIChsb2FkaW5nKSB7XG4gICAgaWYgKHRoaXMuY3VycmVudFBhZ2UgPD0gdGhpcy50b3RhbFBhZ2VzKSB7XG4gICAgICBpZiAobG9hZGluZykge1xuICAgICAgICB0aGlzLmxvYWRNb3JlQnRuLmlubmVySFRNTCA9ICc8c3ZnIHdpZHRoPVwiNTJweFwiIGhlaWdodD1cIjUycHhcIiB4bWxucz1cIi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHZpZXdCb3g9XCIwIDAgMTAwIDEwMFwiIHByZXNlcnZlQXNwZWN0UmF0aW89XCJ4TWlkWU1pZFwiIGNsYXNzPVwidWlsLXJpbmctYWx0XCIgc3R5bGU9XCIgaGVpZ2h0OiAzMHB4O1wiPjxyZWN0IHg9XCIwXCIgeT1cIjBcIiB3aWR0aD1cIjEwMFwiIGhlaWdodD1cIjEwMFwiIGZpbGw9XCJub25lXCIgY2xhc3M9XCJia1wiPjwvcmVjdD48Y2lyY2xlIGN4PVwiNTBcIiBjeT1cIjUwXCIgcj1cIjQwXCIgc3Ryb2tlPVwiI2QwZDBkMFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlLXdpZHRoPVwiMTBcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCI+PC9jaXJjbGU+PGNpcmNsZSBjeD1cIjUwXCIgY3k9XCI1MFwiIHI9XCI0MFwiIHN0cm9rZT1cIiM1NTU1NTVcIiBmaWxsPVwibm9uZVwiIHN0cm9rZS13aWR0aD1cIjZcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT1cInN0cm9rZS1kYXNob2Zmc2V0XCIgZHVyPVwiMnNcIiByZXBlYXRDb3VudD1cImluZGVmaW5pdGVcIiBmcm9tPVwiMFwiIHRvPVwiNTAyXCI+PC9hbmltYXRlPjxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9XCJzdHJva2UtZGFzaGFycmF5XCIgZHVyPVwiMnNcIiByZXBlYXRDb3VudD1cImluZGVmaW5pdGVcIiB2YWx1ZXM9XCIxNzUuNyA3NS4zMDAwMDAwMDAwMDAwMTsxIDI1MDsxNzUuNyA3NS4zMDAwMDAwMDAwMDAwMVwiPjwvYW5pbWF0ZT48L2NpcmNsZT48L3N2Zz4nO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sb2FkTW9yZUJ0bi5pbm5lckhUTUwgPSBcIkV4aWJpciBNYWlzIDxpPjwvaT5cIjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5sb2FkTW9yZUJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubG9hZE1vcmVCdG4uaW5uZXJIVE1MID0gXCJGaW1cIjtcbiAgICAgIHRoaXMubG9hZE1vcmVCdG4uZGlzYWJsZWQgPSB0cnVlO1xuICAgIH1cbiAgfTtcblxuICAvLyBHZW5lcmljIFRpbWUtU2luY2UgZnVuY3Rpb25cbiAgU2NyaWJibGVMaXZlRmVlZC5wcm90b3R5cGUuZ2V0VGltZVNpbmNlID0gZnVuY3Rpb24gKHByZXZpb3VzKSB7XG4gICAgdmFyIG1zUGVyTWludXRlID0gNjAgKiAxMDAwLFxuICAgICAgbXNQZXJIb3VyID0gbXNQZXJNaW51dGUgKiA2MCxcbiAgICAgIG1zUGVyRGF5ID0gbXNQZXJIb3VyICogMjQsXG4gICAgICBtc1Blck1vbnRoID0gbXNQZXJEYXkgKiAzMCxcbiAgICAgIG1zUGVyWWVhciA9IG1zUGVyRGF5ICogMzY1LFxuICAgICAgY3VycmVudCA9IG5ldyBEYXRlKCksXG4gICAgICBzaW5jZSA9IGN1cnJlbnQgLSBwcmV2aW91cztcblxuICAgIGlmIChzaW5jZSA8IG1zUGVyTWludXRlKSB7XG4gICAgICByZXR1cm4gJ0jDoSAnICsgTWF0aC5yb3VuZChzaW5jZSAvIDEwMDApICsgJyBzZWcnO1xuICAgIH0gZWxzZSBpZiAoc2luY2UgPCBtc1BlckhvdXIpIHtcbiAgICAgIHJldHVybiAnSMOhICcgKyBNYXRoLnJvdW5kKHNpbmNlIC8gbXNQZXJNaW51dGUpICsgJyBtaW4nO1xuICAgIH0gZWxzZSBpZiAoc2luY2UgPCBtc1BlckRheSkge1xuICAgICAgaWYgKE1hdGgucm91bmQoc2luY2UgLyBtc1BlckhvdXIpID09PSAxKSByZXR1cm4gJ0jDoSAnICsgTWF0aC5yb3VuZChzaW5jZSAvIG1zUGVySG91cikgKyAnIGhvcmEnO1xuICAgICAgcmV0dXJuICdIw6EgJyArIE1hdGgucm91bmQoc2luY2UgLyBtc1BlckhvdXIpICsgJyBob3Jhcyc7XG4gICAgfSBlbHNlIGlmIChzaW5jZSA8IG1zUGVyTW9udGgpIHtcbiAgICAgIGlmIChNYXRoLnJvdW5kKHNpbmNlIC8gbXNQZXJEYXkpID09PSAxKSByZXR1cm4gJ0jDoSAnICsgTWF0aC5yb3VuZChzaW5jZSAvIG1zUGVyRGF5KSArICcgZGlhJztcbiAgICAgIHJldHVybiAnSMOhICcgKyBNYXRoLnJvdW5kKHNpbmNlIC8gbXNQZXJEYXkpICsgJyBkaWFzJztcbiAgICB9IGVsc2UgaWYgKHNpbmNlIDwgbXNQZXJZZWFyKSB7XG4gICAgICBpZiAoTWF0aC5yb3VuZChzaW5jZSAvIG1zUGVyTW9udGgpID09PSAxKSByZXR1cm4gJ0jDoSAnICsgTWF0aC5yb3VuZChzaW5jZSAvIG1zUGVyTW9udGgpICsgJyBtw6pzJztcbiAgICAgIHJldHVybiAnSMOhICcgKyBNYXRoLnJvdW5kKHNpbmNlIC8gbXNQZXJNb250aCkgKyAnIG1lc2VzJztcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKE1hdGgucm91bmQoc2luY2UgLyBtc1BlclllYXIpID09PSAxKSByZXR1cm4gJ0jDoSAnICsgTWF0aC5yb3VuZChzaW5jZSAvIG1zUGVyWWVhcikgKyAnIGFubyc7XG4gICAgICByZXR1cm4gJ0jDoSAnICsgTWF0aC5yb3VuZChzaW5jZSAvIG1zUGVyWWVhcikgKyAnIGFub3MnO1xuICAgIH1cbiAgfTtcblxuICAvLyBHZW5lcmljIGZ1bmN0aW9uIHRvIGdldCBDdXJyZW50IERldmljZVxuICBTY3JpYmJsZUxpdmVGZWVkLnByb3RvdHlwZS5nZXRDdXJyRGV2aWNlID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB3ID0gd2luZG93LmlubmVyV2lkdGggfHwgd2luZG93LmNsaWVudFdpZHRoIHx8IHdpbmRvdy5jbGllbnRXaWR0aDtcbiAgICByZXR1cm4gKHcgPD0gNzY4KSA/ICdtb2JpbGUnIDogKHcgPD0gMTAyNCkgPyAndGFibGV0JyA6ICdkZXNrdG9wJztcbiAgfTtcblxuICByZXR1cm4gU2NyaWJibGVMaXZlRmVlZDtcblxufSkpKTtcbiJdfQ==
