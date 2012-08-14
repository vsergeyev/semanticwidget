SemanticWidget = {
    init: function(params) {
        var that = this;

        this.api = "providers";
        this.api_item = "provider";
        this.api_endpoint = "https://www.odesk.com/api/profiles/v1/search/" + 
            this.api + ".json?callback=?&";

        this.cloud = new SWFObject("tagcloud.swf", "tagcloud", window.innerWidth, window.innerHeight, "9", "#336699");
        this.cloud.addParam("wmode", "transparent");
        this.cloud.addVariable("mode", "tags");
        this.cloud.addVariable("distr", "true");
        this.cloud.addVariable("tcolor", "0x3b5998");
        this.cloud.addVariable("tcolor2", "0x3b5998");
        this.cloud.addVariable("hicolor", "0x333333");
        this.cloud.addVariable("tspeed", "100");

        // Search box changed
        $("#semantic-query").keyup(function(event){
            if(event.keyCode == 13){
                that.q = $("#semantic-query").val();
                that.api_query();
            }
        });
    },

    // -- JSON REQUEST / RESPONSE --------------------------------------------

    api_response: function(data) {
        $(".semantic-results").html("");
        this.total_results = 0;

        if (data[this.api] && data[this.api]["lister"])
            this.total_results = data[this.api]["lister"]["total_items"];

        if (this.total_results && this.total_results > 0) {
            this.resultset = data[this.api][this.api_item];
            this.build_graph();
        }
        else
            $(".semantic-results").html("No results found...");
    },

    api_query: function() {
        //Performs actual JSONP query to oDesk API
        var that = this;

        $(".semantic-results").html("<img src='http://i245.photobucket.com/albums/gg58/pipoltek/blogs/a-load.gif' />");

        jQuery.getJSON(this.api_endpoint + "q=" + this.q + "&page=0;20",
            function(data) {
                that.api_response(data);
            }
        );
    },

    // -- GRAPH BUILDING -----------------------------------------------------

    prepare_string: function(str) {
        return str.replace(/[^a-zA-Z 0-9]+/g,'').split(" ");
    },

    index_term: function(word, resultset_item_index) {
        // Pushes word into associative array
        // apple -> usage 3, items: [1, 2, 3]

        if (word == "") return;

        if (this.graph.hasOwnProperty(word) && this.graph[word].items.indexOf(resultset_item_index) < 0) {
            this.graph[word].usage++;
            this.graph[word].items.push(resultset_item_index);
        } else {
            this.graph[word] = {
                usage: 1,
                items: [resultset_item_index]
            };
        }
    },

    build_graph: function() {
        var that = this;
        this.graph = {};

        $.each(this.resultset, function(resultset_item_index, item) {
            // Title
            $.each(that.prepare_string(item.dev_profile_title),
                function(i, word) {that.index_term(word, resultset_item_index)});

            // Description
            $.each(that.prepare_string(item.dev_blurb),
                function(i, word) {that.index_term(word, resultset_item_index)});
        });

        //console.log(this.graph);
        var tags = "";
        $.each(this.graph, function(k, v) {
            if ((v.usage > 2) && k !== that.q)
                tags += "<a href='http://" + k + "/' target='_blank' style='" + v.usage + "'>" + k + "</a>";
                //results.append("<div class='semantic-bubble-wrapper'><div class='semantic-bubble" + Math.min(v.usage, 10) + "'>&nbsp;</div></div>");
                //results.append("<div class='semantic-bubble" + Math.min(v.usage, 10) + "'>" + k + "<sup>" + v.usage + "</sup></div>");
        });
        
        this.cloud.addVariable("tagcloud", "<tags>" + tags + "</tags>");
        this.cloud.write("semantic-results");
    }
}