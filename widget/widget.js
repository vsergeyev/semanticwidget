String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

SemanticWidget = {
    init: function(params) {
        var that = this,
            defaults = {
                id: "semantic-widget",
                api: "providers",
                api_item: "provider",
                min_usage: 10,
                max_results: 100,
                max_font_size: 32,
                min_font_size: 6,
                q: "",
                page: 0,
                stop_words: ["Using", "More", "Most", "Very", "Also", "Than",
                    "Me", "You", "Your", "Who", "Up", "Last", "Over", "Based",
                    "And", "Or", "Not", "Both", "It", "Its", "Now", "Since",
                    "Past", "This", "That", "But", "Be", "Been", "Would",
                    "Was", "Which", "Will", "By", "Am", "What", "While", "To",
                    "Some", "Part", "About", "So", "An", "Etc", "As", "From",
                    "At", "Do",
                    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
            };

        // Params
        for (var key in defaults)
            if (params.hasOwnProperty(key))
                this[key] = params[key];
            else
                this[key] = defaults[key];

        this.api_endpoint = "https://www.odesk.com/api/profiles/v1/search/" +
            this.api + ".json?callback=?&";

        // DOM
        this.dom = {
            results: $(".semantic-results"),
            query: $("#semantic-query"),
            progress: $(".semantic-progress"),
            search_button: $(".semantic-input-button"),
            min_usage: $("#semantic-min-usage"),
            max_results: $("#semantic-max-results")
        }

        // Search box initial if param "q"
        if (this.q !== "")
            this.dom.query.val(this.q);

        // Search box changed
        this.dom.query.keyup(function(event){
            if(event.keyCode == 13){
                that.submit();
            }
        });
        // Search button
        this.dom.search_button.click(function(event){
            that.submit();
        });

        $(".semantic-popup").draggable({stack: ".semantic-popup"});

        that.submit();
    },

    // -- JSON REQUEST / RESPONSE --------------------------------------------

    submit: function() {
        this.dom.results.html("");
        this.q = this.dom.query.val();
        this.min_usage = this.dom.min_usage.val();
        this.max_results = this.dom.max_results.val();
        this.api_query("api_response");
    },

    show_spinner: function() {
        this.dom.progress.html("<img src='http://i245.photobucket.com/albums/gg58/pipoltek/blogs/a-load.gif' height=16 />");
    },

    hide_spinner: function() {
        this.dom.progress.html("");
    },

    api_response: function(data) {
        if (data[this.api] && data[this.api]["lister"])
            this.total_results = data[this.api]["lister"]["total_items"];

        if (this.total_results && this.total_results > 0) {
            this.resultset = data[this.api][this.api_item];
            this.build_graph();
        }
        else
            this.dom.results.html("No results found...");
    },

    api_query: function(callback) {
        //Performs actual JSONP query to oDesk API
        var that = this;

        this.show_spinner();

        jQuery.getJSON(this.api_endpoint + "q=" + this.q + "&page=0;" + this.max_results,
            function(data) {
                that.hide_spinner();
                that[callback](data);
                //that.api_response(data);
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
        if (this.stop_words.indexOf(word) !== -1) return;

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

    index_terms: function() {
        var that = this;
        $.each(this.resultset, function(resultset_item_index, item) {
            // Title
            $.each(that.prepare_string(item.dev_profile_title),
                function(i, word) {that.index_term(word.capitalize(), resultset_item_index)});

            // Description
            $.each(that.prepare_string(item.dev_blurb),
                function(i, word) {that.index_term(word.capitalize(), resultset_item_index)});

            // Skills
            //console.log(item.skills.skill);
            if ($.isArray(item.skills.skill))
                $.each(item.skills.skill,
                    function(i, skill) {that.index_term(skill.skl_name.capitalize(), resultset_item_index)})
            else
                if (typeof item.skills.skill !== 'undefined')
                    that.index_term(item.skills.skill.skl_name.capitalize(), resultset_item_index);
        });
    },

    api_response_append: function(data) {
        var that = this,
            node = this.appending_node;

        this.resultset = data[that.api][that.api_item];
        this.index_terms();

        $.each(that.graph_array, function(k, v) {
            if ((v.usage >= that.min_usage) && k !== that.q.capitalize()) {
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
    },

    append_graph: function(node) {
        var that = this;
        this.graph_array = {};
        this.appending_node = node;
        this.show_spinner();
        this.q = node.name;
        this.api_query("api_response_append");
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

        this.index_terms();

        $.each(this.graph_array, function(k, v) {
            if ((v.usage >= that.min_usage) && k !== that.q.capitalize()) {
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
              panning: "avoid nodes",
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
                domElement.onclick = function() {
                    if (that.dom.query.val().search(node.name) < 0) {
                        that.dom.query.val(that.dom.query.val() + " " + node.name);
                        that.append_graph(node);
                    }
                    that.rgraph.onClick(node.id, {
                        onComplete: function() {
                        }
                    });
                };
                domElement.onmouseover = function() {
                    var $this = $(this);
                    this.timer = setTimeout(function() {
                        if ($("#popup-" + node.name).length) return;

                        if (that.graph_array[node.name]) {
                            var popup = $("<div class='semantic-popup' id='popup-" + node.name
                                + "'><div onclick='$(\"#popup-" + node.name + "\").remove();' class='close'>Close</div><div class='title'>"
                                + that.q + " > " + node.name + "</div></div>");

                            $.each(that.graph_array[node.name].items, function(i, v) {
                                $("#providerTemplate").tmpl(that.resultset[v]).appendTo(popup);
                            });

                            $this.after(popup.hide().fadeIn(500));
                            popup.offset($this.offset());

                            popup.draggable({
                                stack: ".semantic-popup",
                                // start: function(event, ui) {
                                    // that.rgraph.config.Navigation.panning = false;
                                // },
                                // stop: function(event, ui) {
                                    // that.rgraph.config.Navigation.panning = "avoid nodes";
                                // }
                            });
                        }
                    }, 1000);
                };
                domElement.onmouseout = function() {
                    clearTimeout(this.timer);
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
                    var f = Math.max(Math.min(node.data.usage, that.max_font_size), that.min_font_size);
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