import * as d3 from 'd3'
import $ from 'jquery'
import _ from 'the-lodash'
import 'bootstrap/js/dist/tooltip'

import VisualNode from './visual-node'
import { flagTooltip } from '../../utils/ui-utils'

class VisualView {

    constructor(parentElem, sharedState, source) {
        this._parentElem = parentElem;
        this.sharedState = sharedState;
        this.source = source;

        this._width = 0
        this._height = 0

        this._viewPos = { x: 0, y: 0 };

        this._showRoot = true
        this._nodeDict = {};
        this._selectedNodes = []
        this._currentSelectedNodeDn = null;

        this._controlInfo = {}

        this._flatVisualNodes = []

        this._existingNodeIds = {}
        
        this._markerData = {}

        sharedState.subscribe("selected_dn",
            (selected_dn) => {

                this._updateSelection(selected_dn);

            });

        sharedState.subscribe('markers_dict',
            (markers_dict) => {
                this._markerData = markers_dict;
                if (!markers_dict) {
                    this._markerData = {};
                }
                this.updateAll(true);
            });
    }

    getExpanded(dn)
    {
        var dict = this.sharedState.get('diagram_expanded_dns');
        if (dict[dn]) {
            return true;
        }
        return false;
    }

    setExpanded(dn, value)
    {
        var dict = this.sharedState.get('diagram_expanded_dns');
        dict[dn] = value;
        this.sharedState.set('diagram_expanded_dns', dict, { skipCompare: true });
    }

    _measureText(text, fontSpec) {
        if (!fontSpec) {
            throw new Error('MISSING FONT SPEC')
        }

        if (_.isNil(text)) {
            text = ''
        } else if (!_.isString(text)) {
            text = text.toString()
        }

        var totalWidth = 0
        var totalHeight = fontSpec.height
        for (var i = 0; i < text.length; i++) {
            var code = text.charCodeAt(i)
            var index = code - fontSpec.startCode
            var width
            if (index < 0 || index >= fontSpec.widths.length) {
                width = fontSpec.defaultWidth
            } else {
                width = fontSpec.widths[index]
            }
            totalWidth += width
        }
        return {
            width: totalWidth,
            height: totalHeight
        }
    }

    skipShowRoot() {
        this._showRoot = false
    }

    setup() {
        this._d3NodeDict = {}
        this._d3SmallNodeDict = {}

        this._svgElem = this._parentElem
            .append('svg')
            .attr('position', 'absolute')
            .attr('overflow', 'hidden')
            .attr('top', 0)
            .attr('left', 0)
            .attr('right', 0)
            .attr('bottom', 0)

        $(document).on('layout-resize-universeComponent', () => {
            this.setupDimentions()
        })

        this.setupDimentions()

        this._rootElem = this._svgElem.append('g')

        this._renderControl()

        this._setupPanning()
    }

    _renderControl() {
        var self = this

        this._controlInfo.previewGroupElem = this._svgElem.append('g')
            .attr('class', 'preview')

        this._controlInfo.previewFullRectElem = this._controlInfo.previewGroupElem
            .append('rect')
            .attr('class', 'preview-full-rect')

        this._controlInfo.previewItemsGroupElem = this._controlInfo.previewGroupElem
            .append('g')
            .attr('class', 'preview-items-group')


        this._controlInfo.previewVisibleRectElem = this._controlInfo.previewGroupElem
            .append('rect')
            .attr('class', 'preview-visible-rect')

        this._controlInfo.previewGroupElem
            .on('click', () => {
                let pt = this._svgElem.node().createSVGPoint()
                pt.x = d3.event.clientX
                pt.y = d3.event.clientY
                var target = self._controlInfo.previewFullRectElem._groups[0][0]
                var cursorpt = pt.matrixTransform(target.getScreenCTM().inverse())

                this._userPanTo(
                    cursorpt.x / self._controlInfo.scale - this._width / 2, 
                    cursorpt.y / self._controlInfo.scale - this._height / 2);
            })
            .call(d3.drag()
                .on('drag', () => {

                    this._userPanTo(
                        this._viewPos.x + d3.event.dx / this._controlInfo.scale, 
                        this._viewPos.y + d3.event.dy / this._controlInfo.scale,
                        true);
                }))
    }

    setupDimentions(size) {
        if (!size) {
            size = this._parentElem.node().getBoundingClientRect()
        }
        this._width = size.width
        this._height = size.height

        this._setupControl()
        this._applyPanTransform()
    }

    _setupControl() {
        if (!this._visualRoot) {
            return
        }

        var boxScale = 5
        this._controlInfo.boxWidth = Math.max(100, this._width / boxScale)
        this._controlInfo.boxHeight = Math.max(100, this._height / boxScale)

        this._controlInfo.scale = Math.min(
            this._controlInfo.boxWidth / this._visualRoot.width,
            this._controlInfo.boxHeight / this._visualRoot.height)

        this._controlInfo.boxWidth =
            Math.max(100, this._visualRoot.width * this._controlInfo.scale)
        this._controlInfo.boxHeight =
            Math.max(100, this._visualRoot.height * this._controlInfo.scale)

        this._controlInfo.x = this._width - this._controlInfo.boxWidth - 20
        this._controlInfo.y = this._height - this._controlInfo.boxHeight - 20

        if (this._controlInfo.previewGroupElem) {
            this._controlInfo.previewGroupElem.attr('transform', () => {
                return 'translate(' + this._controlInfo.x + ',' + this._controlInfo.y + ')'

            })
        } else {
            throw new Error('MISSING PREVIEW GROUP ELEM')
        }

        if (this._controlInfo.previewFullRectElem) {
            this._controlInfo.previewFullRectElem
                .attr('width', this._controlInfo.boxWidth)   // this._visualRoot.width * this._controlInfo.scale)
                .attr('height', this._controlInfo.boxHeight) // this._visualRoot.height * this._controlInfo.scale);
        }

        if (this._controlInfo.previewItemsGroupElem) {
            this._controlInfo.previewItemsGroupElem.attr('transform', () => {
                return 'scale(' + this._controlInfo.scale + ', ' + this._controlInfo.scale + ')'

            })
        }

        if (this._controlInfo.previewVisibleRectElem) {
            this._controlInfo.previewVisibleRectElem
                .attr('x', this._viewPos.x * this._controlInfo.scale)
                .attr('y', this._viewPos.y * this._controlInfo.scale)
                .attr('width', this._width * this._controlInfo.scale)
                .attr('height', this._height * this._controlInfo.scale)

        }
    }

    _setupPanning() {
        this._setupPanningByMouseDrag()

        this._setupPanningByWheel()

        this._applyPanTransform()
    }

    _setupPanningByMouseDrag() {
        var drag = d3.drag()
            .on('drag', () => {
                this._userPanTo(
                    this._viewPos.x - d3.event.dx,
                    this._viewPos.y - d3.event.dy,
                    true);
            })

        this._svgElem.call(drag)
    }

    _setupPanningByWheel() {
        var doScroll = (e) => {
            this._userPanTo(
                this._viewPos.x + e.deltaX,
                this._viewPos.y + e.deltaY,
                true);
            e.preventDefault()
        }

        var elem = document.getElementById('diagram')
        if (elem.addEventListener) {
            elem.addEventListener('wheel', doScroll, false)
        }
    }

    _activatePanning()
    {
        if (!this.sharedState.get('auto_pan_to_selected_dn')) {
            return;
        }

        var visualNode = this._nodeDict[this.sharedState.get('selected_dn')];
        if (!visualNode) {
            return;
        }

        this._panTo(
            visualNode.absX - Math.max(this._width / 2 - visualNode.width / 2, 10), 
            visualNode.absY - Math.max(this._height / 2 - visualNode.height / 2, 10))
    }

    _userPanTo(x, y, skipAnimate)
    {
        this.sharedState.set('auto_pan_to_selected_dn', false)
        this._panTo(x, y, skipAnimate);
    }

    _panTo(x, y, skipAnimate)
    {
        var targetViewPos = this._fixViewPos({ x: x, y: y });

        if (skipAnimate) {
            this._stopPanAnimation();
            this._viewPos = targetViewPos;
            this._applyPanTransform();
        } else {
            this._panInterpolator = d3.interpolate(
                this._viewPos,
                targetViewPos
            );
    
            this._panAnimationDuration = 200;
            this._panInterpolatorStartTime = new Date();
            this._animatePanTransform();
        }

    }

    _animatePanTransform()
    {
        if (this._panAnimationTimer) {
            return;
        }

        this._panAnimationTimer = setTimeout(() => {
            this._panAnimationTimer = null;
            var date = new Date();
            var diff = date - this._panInterpolatorStartTime;
            if (!this._panAnimationDuration) {
                return;
            }

            var t = diff / this._panAnimationDuration;
            this._viewPos = this._panInterpolator(t);
            this._applyPanTransform();

            if (t < 1.0) {
                this._animatePanTransform();
            } else {
                this._stopPanAnimation();
            }
        }, 10)
    }

    _stopPanAnimation()
    {
        this._panInterpolator = null;
        this._panInterpolatorStartTime = null;
        this._panAnimationDuration = null;
        if (this._panAnimationTimer) {
            clearTimeout(this._panAnimationTimer);
            this._panAnimationTimer = null;
        }
    }

    _applyPanTransform() {
        if (!this._rootElem) {
            return
        }

        var pos = this._viewPos;
        // var pos = this._fixViewPos(this._viewPos);

        this._rootElem.attr('transform', () => {
            return 'translate(' + (-pos.x) + ',' + (-pos.y) + ')'
        })

        // const interpolator = d3.interpolate(
        //     [0, "0.5 mile", [12]],
        //     [10, "28 miles", [36]]
        //   );
        // console.log(interpolator(0.5));
          
        this._setupControl()
    }

    _fixViewPos(pos)
    {
        var newPos = { x: pos.x, y : pos.y };

        if (this._visualRoot) {
            newPos.x = Math.min(this._visualRoot.width - this._width, newPos.x)
            newPos.y = Math.min(this._visualRoot.height - this._height, newPos.y)
        }

        newPos.x = Math.max(0, newPos.x)
        newPos.y = Math.max(0, newPos.y)

        return newPos;
    }

    acceptSourceData(sourceData) {
        this._nodeDict = {};
        this._visualRoot = this._packSourceData(sourceData)
        this._massageSourceData()
        this._setupControl()
    }

    _packSourceData(root) {
        var recurse = (node, parent) => {
            var visualNode = new VisualNode(this, node, parent)
            if (!node.children) {
                node.children = []
            }
            for (var child of node.children) {
                recurse(child, visualNode)
            }
            visualNode.prepare()
            this._nodeDict[visualNode.id] = visualNode;
            return visualNode
        }

        return recurse(root, null)
    }

    _massageSourceData() {
        if (!this._visualRoot) {
            return
        }
        this._visualRoot.autoexpand()
        this._visualRoot.measureAndArrange()
        this._visualRoot.calculateAbsolutePos()
        this._flatVisualNodes = this._visualRoot.extract()
        if (!this._showRoot) {
            this._flatVisualNodes.shift()
        }
    }

    render() {
        if (!this._rootElem) {
            return;
        }

        this._renderItems(this._rootElem, this._flatVisualNodes)
        this._renderSmallItems()
    }

    _renderSmallItems() {
        this._renderItemsSmall(this._controlInfo.previewItemsGroupElem, this._flatVisualNodes)
    }

    _renderItems(parentNode, items) {
        var self = this
        var node =
            parentNode.selectAll('.node') //selectAll('g')
                .data(items, function (d) {
                    return d.id
                })

        node
            .exit()
            .each(function (d) {
                delete self._d3NodeDict[d.id]
            })
            .remove()

        node = node
            .enter()
            .append('g')
            .attr('class', function (d) {
                if (d.isSelected) {
                    return 'node selected'
                }
                return 'node'
            })
            .attr('id', function (d) {
                return d.id
            })
            .attr('transform', nodeGroupTransform)
            .each(function (d) {
                self._d3NodeDict[d.id] = this
            })

        node.append('rect')
            .attr('class', 'node-bg')
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .style('fill', nodeBgFillColor)
            .style('stroke', nodeStrokeColor)


        node.append('rect')
            .attr('class', 'node-header')
            .attr('width', nodeWidth)
            .attr('height', nodeHeaderBgHeight)
            .style('fill', nodeHeaderBgFillColor)
            .on('click', nodePerformSelect)
            .on('dblclick', nodePerformExpandCollapse)


        node.append('rect')
            .attr('class', 'node-header-hl')
            .attr('width', nodeHeaderBgWidth)
            .attr('height', nodeHeaderBgHeight)
            .style('fill', nodeHeaderHlFillColor)
            .on('click', nodePerformSelect)
            .on('dblclick', nodePerformExpandCollapse)


        node
            .append('image')
            .attr('class', 'node-logo')
            .attr('xlink:href', function (d) {
                return getNodeLogoUrl(d.data.kind)
            })
            .attr('x', nodeHeaderX('logo'))
            .attr('y', nodeHeaderY('logo'))
            .attr('width', nodeHeaderWidth('logo'))
            .attr('height', nodeHeaderHeight('logo'))
            .on('click', nodePerformSelect)
            .on('dblclick', nodePerformExpandCollapse)


        node.append('text')
            .attr('class', 'node-title-kind')
            .text(nodeHeaderText('title-kind'))
            .attr('transform', nodeHeaderTransform('title-kind'))
            .on('click', nodePerformSelect)
            .on('dblclick', nodePerformExpandCollapse)


        node.append('text')
            .attr('class', 'node-title-name')
            .text(nodeHeaderText('title-name'))
            .attr('transform', nodeHeaderTransform('title-name'))
            .on('click', nodePerformSelect)
            .on('dblclick', nodePerformExpandCollapse)


        node
            .each(function (d) {
                self._renderNodeExpander(d)
                self._renderNodeSeverity(d)
                self._renderNodeFlags(d)
                self._renderNodeMarkers(d)
            })
    }

    _renderNodeExpander(visualNode) {
        var selection =
            d3.select(visualNode.node)
                .selectAll('.node-expander')
                .data(visualNode.expanderNodes, function (x) {
                    return x.headerName
                })

        selection
            .exit()
            .remove()

        selection
            .enter()
            .append('image')
            .attr('class', 'node-expander')
            .attr('xlink:href', x => x.imgSrc)
            .attr('x', x => x.x())
            .attr('y', x => x.y())
            .attr('width', x => x.width())
            .attr('height', x => x.height())
            .on('click', nodePerformExpandCollapse)

    }

    _renderNodeSeverity(visualNode) {
        {
            var selection =
                d3.select(visualNode.node)
                    .selectAll('.node-severity')
                    .data(visualNode.severityNodes, function (x) {
                        return x.headerName
                    })

            selection
                .exit()
                .remove()

            selection
                .enter()
                .append('rect')
                .attr('class', 'node-severity')
                .attr('x', x => x.x())
                .attr('y', x => x.y())
                .attr('width', x => x.width())
                .attr('height', x => x.height())
                .attr('rx', 10)
                .style('fill', x => x.fill)
                .style('stroke', 'rgb(53, 55, 62)')
                .style('stroke-width', '1')
                .on('click', nodePerformSelect)
                .on('dblclick', nodePerformExpandCollapse)
        }

        {
            // eslint-disable-next-line no-redeclare
            var selection =
                d3.select(visualNode.node)
                    .selectAll('.node-severity-text')
                    .data(visualNode.severityTextNodes, function (x) {
                        return x.headerName
                    })

            selection
                .exit()
                .remove()

            selection
                .enter()
                .append('text')
                .attr('class', 'node-severity-text')
                .text(x => x.text())
                .attr('transform', x => x.transform())
                .on('click', nodePerformSelect)
                .on('dblclick', nodePerformExpandCollapse)
        }
    }

    _renderNodeFlags(visualNode) {
        var self = this
        var selection =
            d3.select(visualNode.node)
                .selectAll('.node-flag')
                .data(visualNode.flagNodes, function (x) {
                    return x.headerName
                })

        selection
            .exit()
            .remove()

        selection
            .enter()
            .append('image')
            .attr('class', 'node-flag')
            .attr('xlink:href', x => x.imgSrc)
            .attr('x', x => x.x())
            .attr('y', x => x.y())
            .attr('width', x => x.width())
            .attr('height', x => x.height())
            .on('mouseover', function (d) {
                self._showFlagTooltip(this, d.flag)
            })
    }

    _renderNodeMarkers(visualNode) {
        var self = this
        var selection =
            d3.select(visualNode.node)
                .selectAll('.node-marker')
                .data(visualNode.markerNodes, function (x) {
                    return x.headerName
                })

        selection
            .exit()
            .remove()

        selection = selection
            .enter()
            .append('g')
            .attr('class', 'node-marker')
            .attr('id', function (d) {
                return d.id
            })
            .attr('transform', x => x.transform())
            .on('mouseover', function (d) {
                self._showMarkerTooltip(this, d.marker)
            })

        selection
            .append('rect')
            .attr('class', 'marker-bg')
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('width', 20)
            .attr('height', 20)
            .style('fill', '#292A2F')

        selection
            .append('text')
            .attr('class', 'marker-text')
            .attr('x', 10)
            .attr('y', 10)
            .attr('dominant-baseline', 'middle')
            .attr('text-anchor', 'middle')
            .attr('fill', x => x.fill())
            .html(x => x.html())
    }

    _showFlagTooltip(elem, name) {
        var descr = flagTooltip(name);
        this._showTooltip(elem, descr);
    }

    _showMarkerTooltip(elem, name) {
        var descr = 'Marker <b>' + name + '</b>';
        this._showTooltip(elem, descr);
    }

    _showTooltip(elem, descr) {
        if (!descr) {
            return
        }
        var template =
            '<div class="tooltip">' +
            '	<div class="tooltip-arrow"></div>' +
            '	<div class="tooltip-inner"></div>' +
            '</div>'
        $(elem).tooltip({
            template: template,
            title: descr,
            html: true
        })
        $(elem).tooltip('show')
    }

    _updateNode(visualNode, isFullUpdate) {
        var duration = 200

        if (!visualNode.node) {
            return
        }

        if (isFullUpdate) {
            this._renderNodeExpander(visualNode)
            this._renderNodeSeverity(visualNode)
            this._renderNodeFlags(visualNode)
            this._renderNodeMarkers(visualNode)
        } 
            
        d3
            .select(visualNode.node)
            .selectAll('.node-flag')
            .transition()
            .duration(duration)
            .attr('x', x => {
                return x.x()
            })
            .attr('y', x => x.y())

        d3
            .select(visualNode.node)
            .selectAll('.node-marker')
            .transition()
            .duration(duration)
            .attr('transform', x => x.transform())

        d3
            .select(visualNode.node)
            .selectAll('.node-marker')
            .selectAll('.marker-text')
            .html(x => x.html())
            .transition()
            .duration(duration)
            .attr('fill', x => x.fill())

        d3
            .select(visualNode.node)
            .selectAll('.node-severity')
            .transition()
            .duration(duration)
            .attr('x', x => {
                return x.x()
            })


        d3
            .select(visualNode.node)
            .selectAll('.node-severity-text')
            .text(x => {
                return x.text()
            })
            .transition()
            .duration(duration)
            .attr('transform', x => {
                return x.transform()
            })


        d3
            .select(visualNode.node)
            .transition()
            .duration(duration)
            .attr('class', function (d) {
                if (d.isSelected) {
                    return 'node selected'
                }
                return 'node'
            })
            .attr('transform', nodeGroupTransform)

        d3
            .select(visualNode.node)
            .select('.node-bg')
            .transition()
            .duration(duration)
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .style('fill', nodeBgFillColor)
            .style('stroke', nodeStrokeColor)

        d3
            .select(visualNode.node)
            .select('.node-header')
            .transition()
            .duration(duration)
            .attr('width', nodeWidth)
            .attr('height', nodeHeaderBgHeight)
            .style('fill', nodeHeaderBgFillColor)

        d3
            .select(visualNode.node)
            .select('.node-header-hl')
            .transition()
            .duration(duration)
            .attr('width', nodeHeaderBgWidth)
            .attr('height', nodeHeaderBgHeight)
            .style('fill', nodeHeaderHlFillColor)

        d3
            .select(visualNode.node)
            .select('.node-expander')
            .transition()
            .duration(duration)
            .attr('x', x => {
                var expanderNode = _.head(x.expanderNodes)
                if (expanderNode) {
                    return expanderNode.x()
                }
                return 0
            })
            .attr('xlink:href', x => {
                var expanderNode = _.head(x.expanderNodes)
                if (expanderNode) {
                    return expanderNode.imgSrc
                }
                return 0
            })


        this._updateNodeSmall(visualNode)
    }

    _renderItemsSmall(parentNode, items) {
        var self = this
        var node =
            parentNode.selectAll('g')
                .data(items, function (d) {
                    return d.id
                })

        node
            .exit()
            .each(function (d) {
                delete self._d3SmallNodeDict[d.id]
            })
            .remove()

        node = node
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('id', function (d) {
                return d.id
            })
            .attr('transform', nodeGroupTransform)
            .each(function (d) {
                self._d3SmallNodeDict[d.id] = this
            })

        node.append('rect')
            .attr('class', 'node-bg')
            .attr('width', function (d) {
                return d.width
            })
            .attr('height', function (d) {
                return d.height
            })
            .style('fill', nodeBgFillColor)


        node.append('rect')
            .attr('class', 'node-header-hl')
            .attr('width', function (d) {
                return d.width
            })
            .attr('height', function (d) {
                return d.headerHeight
            })
            .style('fill', nodeHeaderHlFillColor)

    }

    _updateNodeSmall(visualNode) {
        var duration = 200

        if (!visualNode.smallNode) {
            return
        }

        d3
            .select(visualNode.smallNode)
            .transition()
            .duration(duration)
            .attr('transform', nodeGroupTransform)

        d3
            .select(visualNode.smallNode)
            .select('.node-bg')
            .transition()
            .duration(duration)
            .attr('width', function (d) {
                return d.width
            })
            .attr('height', function (d) {
                return d.height
            })

        d3
            .select(visualNode.smallNode)
            .select('.node-header-hl')
            .transition()
            .duration(duration)
            .attr('width', function (d) {
                return d.width
            })
            .style('fill', nodeHeaderHlFillColor)
    }

    _updateNodeR(visualNode, isFullUpdate) {
        this._updateNode(visualNode, isFullUpdate)
        for (var child of visualNode.visibleChildren) {
            this._updateNodeR(child, isFullUpdate)
        }
    }

    _updateSelection(selected_dn)
    {
        if (this._currentSelectedNodeDn)
        {
            if (this._currentSelectedNodeDn != selected_dn)
            {
                var node = this._nodeDict[this._currentSelectedNodeDn];
                this._currentSelectedNodeDn = null;
                if (node) {
                    this._updateNode(node);
                }
            }
        }

        if (this._currentSelectedNodeDn != selected_dn)
        {
            this._currentSelectedNodeDn = selected_dn;
            var node = this._nodeDict[this._currentSelectedNodeDn];
            if (node) {
                this._updateNode(node);
            }
        }

        this._activatePanning();
    }

    updateAll(isFullUpdate) {

        this._massageSourceData()
        this._applyPanTransform()
        this._setupControl()
        this.render()
        if (this._visualRoot) {
            this._updateNodeR(this._visualRoot, isFullUpdate)
        }
        this._setupControl()
        this._activatePanning();
    }

    handleVisualNodeClick(visualNode) {
        this.sharedState.set('auto_pan_to_selected_dn', false)

        if (visualNode.isSelected)
        {
            this.sharedState.set('selected_dn', null);
        }
        else
        {
            this.sharedState.set('selected_dn', visualNode.id);
        }
    }

}

function nodePerformExpandCollapse(d) {
    d.isExpanded = !d.isExpanded
    d.view.updateAll()
}

function nodePerformSelect(d) {
    if (d.view) {
        d.view.handleVisualNodeClick(d);
    }
}

function nodeHeight(d) {
    return d.height
}

function nodeWidth(d) {
    return d.width
}

function nodeHeaderBgHeight(d) {
    return d.headerHeight
}

function nodeHeaderBgWidth(d) {
    if (d.isSelected) {
        return d.width
    }
    return d.headerHeight
}

function nodeHeaderBgFillColor(d) {
    return d.headerBgFillColor
}

function nodeHeaderHlFillColor(d) {
    return d.headerFillColor
}

function nodeBgFillColor(d) {
    return d.bgFillColor
}

function nodeStrokeColor(d) {
    return d.strokeColor
}

function nodeGroupTransform(d) {
    return 'translate(' + d.absX + ',' + d.absY + ')'
}

function nodeHeaderTransform(headerName, flavor) {
    return (d) => {
        return 'translate(' + d.getHeaderX(headerName, flavor) + ',' + d.getHeaderY(headerName, flavor) + ')'
    }
}

function nodeHeaderX(headerName, flavor) {
    return (d) => {
        return d.getHeaderX(headerName, flavor)
    }
}

function nodeHeaderY(headerName, flavor) {
    return (d) => {
        return d.getHeaderY(headerName, flavor)
    }
}

function nodeHeaderWidth(headerName, flavor) {
    return (d) => {
        var header = d.getHeader(headerName)
        if (!header) {
            // TODO: Error
            return 0
        }
        if (flavor) {
            return header[flavor].width
        }
        return header.width
    }
}

function nodeHeaderHeight(headerName, flavor) {
    return (d) => {
        var header = d.getHeader(headerName)
        if (!header) {
            // TODO: Error
            return 0
        }
        if (flavor) {
            return header[flavor].height
        }
        return header.height
    }
}

function nodeHeaderText(headerName) {
    return (d) => {
        var header = d.getHeader(headerName)
        if (!header) {
            // TODO: Error
            return ''
        }
        return header.text
    }
}

function getNodeLogoUrl(kind) {
    return '/img/entities/' + kind + '.svg'
}

export default VisualView
