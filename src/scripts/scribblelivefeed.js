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

    this.version = '2.4.6';

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
      MediaHtml = "<embed type='application/x-shockwave-flash' src='http://embed.scribblelive.com/js/jwflvplayer/player-licensed.swf?ThreadId=" + this.Options.EventId + "' flashvars='file=" + Media.Url + "'>";
    }
    if (pPost.Type === "AUDIO" && Media.Type === "AUDIO") {
      MediaHtml = "<embed height='20' width='300' type='application/x-shockwave-flash' src='http://embed.scribblelive.com/js/jwflvplayer/player-licensed.swf?ThreadId=" + this.Options.EventId + "' flashvars='file=" + Media.Url + "'>";
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
      js.src = 'http://embed.scribblelive.com/modules/lib/addons.js';
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
