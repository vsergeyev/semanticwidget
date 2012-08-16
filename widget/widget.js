String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

SemanticWidget = {
    init: function(params) {
        var that = this;

        this.max_results = 100;
        this.min_usage = 9;
        this.api = "providers";
        this.api_item = "provider";
        this.api_endpoint = "https://www.odesk.com/api/profiles/v1/search/" +
            this.api + ".json?callback=?&";

        this.dom = {
            results: $(".semantic-results"),
            query: $("#semantic-query"),
            progress: $(".semantic-progress"),
            button: $(".semantic-input-button"),
            
        }

        // Search box changed
        this.dom.query.keyup(function(event){
            if(event.keyCode == 13){
                that.submit();
            }
        });
        // Search button
        this.dom.button.click(function(event){
            that.submit();
        });

        that.submit();
    },

    // -- JSON REQUEST / RESPONSE --------------------------------------------

    submit: function() {
        this.dom.results.html("");
        this.q = this.dom.query.val();
        this.max_results = $("#semantic-max-results").val();
        this.min_usage = $("#semantic-min-usage").val();
        this.api_query();
    },

    show_spinner: function() {
        this.dom.progress.html("<img src='http://i245.photobucket.com/albums/gg58/pipoltek/blogs/a-load.gif' height=16 />");
    },

    hide_spinner: function() {
        this.dom.progress.html("");
    },

    api_response: function(data) {
        this.hide_spinner();
        this.total_results = 0;

        if (data[this.api] && data[this.api]["lister"])
            this.total_results = data[this.api]["lister"]["total_items"];

        if (this.total_results && this.total_results > 0) {
            this.resultset = data[this.api][this.api_item];
            this.build_graph();
        }
        else
            this.dom.results.html("No results found...");
    },

    api_query: function() {
        //Performs actual JSONP query to oDesk API
        var that = this;

        this.show_spinner();

        jQuery.getJSON(this.api_endpoint + "q=" + this.q + "&page=0;" + this.max_results,
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

        if (this.graph_array.hasOwnProperty(word) && this.graph_array[word].items.indexOf(resultset_item_index) < 0) {
            this.graph_array[word].usage++;
            this.graph_array[word].items.push(resultset_item_index);
        } else {
            this.graph_array[word] = {
                usage: 1,
                items: [resultset_item_index]
            };
        }
    },

    append_graph: function(node) {
        var that = this;
        this.graph_array = {};

        this.show_spinner();

        jQuery.getJSON(this.api_endpoint + "q=" + node.name + "&page=0;" + that.max_results,
            function(data) {
                that.hide_spinner();

                $.each(data[that.api][that.api_item], function(resultset_item_index, item) {
                    // Title
                    $.each(that.prepare_string(item.dev_profile_title),
                        function(i, word) {that.index_term(word.capitalize(), resultset_item_index)});

                    // Description
                    $.each(that.prepare_string(item.dev_blurb),
                        function(i, word) {that.index_term(word.capitalize(), resultset_item_index)});
                });

                $.each(that.graph_array, function(k, v) {
                    if ((v.usage > that.min_usage) && k !== that.q.capitalize()) {
                        var new_node = {
                            id: k,
                            name: k,
                            data: {
                                usage: v.usage
                            },
                            children: []
                        }
                        that.rgraph.graph.addNode(new_node);
                        that.rgraph.graph.addAdjacence(node, new_node, {});
                    }
                });
                that.rgraph.refresh();
            }
        );
    },

    build_graph: function() {
        var that = this,
            words = [];
        this.graph_array = {};
        this.graph = {
            id: this.q,
            name: this.q,
            children: []
        };

        $.each(this.resultset, function(resultset_item_index, item) {
            // Title
            $.each(that.prepare_string(item.dev_profile_title),
                function(i, word) {that.index_term(word.capitalize(), resultset_item_index)});

            // Description
            $.each(that.prepare_string(item.dev_blurb),
                function(i, word) {that.index_term(word.capitalize(), resultset_item_index)});
        });

        $.each(this.graph_array, function(k, v) {
            if ((v.usage > that.min_usage) && k !== that.q.capitalize()) {
                that.graph.children.push({
                    id: k,
                    name: k,
                    data: {
                        usage: v.usage
                        },
                    children: []
                });
                //$("#wordTemplate").tmpl({"k": k, "v": v}).appendTo("#semantic-results");
            }
        });

        // Graph
        this.rgraph = new $jit.RGraph({
            //Where to append the visualization
            injectInto: 'semantic-results',
            //Optional: create a background canvas that plots
            //concentric circles.
            background: {
              CanvasStyles: {
                strokeStyle: '#eee'
              }
            },
            levelDistance: 200,
            //Add navigation capabilities:
            //zooming by scrolling and panning.
            Navigation: {
              enable: true,
              panning: true,
              zooming: 50
            },
            //Set Node and Edge styles.
            Node: {
                color: '#555'
            },

            Edge: {
              color: '#eee',
              lineWidth:1
            },

            onBeforeCompute: function(node){
                //Log.write("centering " + node.name + "...");
                //Add the relation list in the right column.
                //This list is taken from the data property of each JSON node.
                //$jit.id('inner-details').innerHTML = node.data.relation;
            },

            //Add the name of the node in the correponding label
            //and a click handler to move the graph.
            //This method is called once, on label creation.
            onCreateLabel: function(domElement, node){
                domElement.innerHTML = node.name;
                if (node._depth >= 1)
                    domElement.innerHTML = node.name + "<sup>" + node.data.usage + "</sup>";
                domElement.onclick = function(){
                    that.rgraph.onClick(node.id, {
                        onComplete: function() {
                            if (that.dom.query.val().search(node.name) < 0) {
                                that.dom.query.val(that.dom.query.val() + " " + node.name);
                                that.append_graph(node);
                            }
                        }
                    });
                };
            },
            //Change some label dom properties.
            //This method is called each time a label is plotted.
            onPlaceLabel: function(domElement, node){
                var style = domElement.style;
                style.display = '';
                style.cursor = 'pointer';

                if (node._depth < 1)
                    style.fontSize = "2em"
                else {
                    var f = Math.max(Math.min(node.data.usage*3, 20), 8);
                    var c = 4 * Math.round(50 - Math.min(node.data.usage, 40));
                    style.fontSize = f+"px";
                    style.color = "rgb(" + c + "," + c + "," + c + ")";
                }
                var left = parseInt(style.left);
                var w = domElement.offsetWidth;
                style.left = (left - w / 2) + 'px';
            }
        });

        this.rgraph.loadJSON(this.graph);
        //trigger small animation
        this.rgraph.compute('end');
        this.rgraph.fx.animate({
            modes:['polar'],
            duration: 2000
        });
    }
}