﻿import * as maptalks from 'maptalks';

export class FeatureLayer extends maptalks.VectorLayer {
    static addFeature(features){
        return this.addGeometry(features);
    }

    addGeometry(geometries){
        for (var i = 0, len = geometries.length; i <= len; i++) {
            if (!geometries[i] instanceof maptalks.Geometry) {
                throw new Error('Only a geometry can be added into a Layer');
            }
        }
        if (this.breakClassRender == true) {
            this._breakRenderLayer(this.breakClasses, geometries);
        }
        var geos= super.addGeometry.apply(this, arguments);
        if (this.loadend) {
            this.fire('loadend', { geometries: this.geometryList });
        }
        return geos;
    }
    /**
  * Reproduce a FeatureLayer from VectorLayer.
  * @param  {String} id - layer's id
  * @static
  * @private
  * @function
  */
    constructor(id,url,options){
        var _options={}||options;
        super(_options);
        this.setId(id);
        this.breakClassRender=false,
        this.selected=false,
        this.loadend=false,
        this.featureCount=0,
        this.geometryList=[],
        this.breakClassRender = this.breakClassRender || _options.breakClassRender;
        this.selected = this.selected || _options.selected;
        this.query = this.query || _options.query;
        this.displayField = this.displayField || _options.displayField;
        this.outputLayerName = this.outputLayerName || _options.layerName;
        this._postDataFrom(url);
    }
    setRenderProperty(attri){
        this.renderAtrribute = attri;
        this.breakClassRender = true;
    }
    setBreakRender (breakRender) {
        this.breakClasses = this.breakClasses || [];
        if (!breakRender.length) {
            this.breakClasses.push(breakRender)
        }
        else if (breakRender instanceof Array) {
            this.breakClasses = this.breakClasses.concat(breakRender);
        }
    }

    _breakRenderLayer(breakclasses,geometries){
        if (!breakclasses) {
            throw new Error("you need set render field and set rendered classes!");
            return;
        };
        if (!breakclasses.length) {
            this.setBreakRender(breakclasses);
            return;
        }
        if (!this.layerData) {
            throw new Error('layer data not exist!');
            return;
        }
        if (breakclasses instanceof Array) {
            var flen = geometries.length;
            var that = this;
            for (var j = 0; j < flen; j++) {
                var fea = this.layerData.features[j];
                //供测试用的属性
                fea.attributes[this.renderAtrribute] = 100000 * Math.random();
            }
            breakclasses.forEach(function (breakclass) {
                for (var i = 0; i < flen; i++) {
                    var fea = that.layerData.features[i];
                    //供测试用的属性
                    var geo = that._getGeometry(geometries, fea.attributes.OBJECTID);
                    var _attri = parseInt(fea.attributes[that.renderAtrribute]);
                    if (_attri >= breakclass.minValue && _attri < breakclass.maxValue) {
                        //对对象设置符号
                        geo.setSymbol(breakclass.renderSymbol);
                    }
                }
            });
        }
    }
  
    _getGeometry(geometries,id){
        if(!geometries.length) return;
        for(var i=0;i<geometries.length;i++){
            if (geometries[i].getId() === id) {
                return geometries[i];
                break;
            }
        }
    }
    _postDataFrom (url) {
        var _url = url;
        this.dataUrl = url;
        var that = this;
        var proxyUrl = "../proxy/proxy.ashx";
        var requestUrl = proxyUrl;
        //region请求网络数据
        maptalks.Ajax.post({
            url: requestUrl
        }, 'url=' + encodeURIComponent(_url) + '&filter=' + encodeURIComponent('?f=pjson'), function (err, res) {
            var lInfo = maptalks.Util.parseJSON(res);
            var countFilter = "/query?text=&geometry=&geometryType=esriGeometryPoint&inSR=&spatialRel=esriSpatialRelIntersects&relationParam=&objectIds=&where=1%3D1&time=&returnCountOnly=true&returnIdsOnly=false&returnGeometry=true&maxAllowableOffset=&outSR=&outFields=&f=pjson";
            maptalks.Ajax.post({ url: requestUrl }, 'url=' + encodeURIComponent(_url) + '&filter=' + encodeURIComponent(countFilter), function (err, response) {
                if (err) return;
                var data = maptalks.Util.parseJSON(response);
                var count = data.count;
                var times = Math.ceil(count / 1000);
                for (var i = 1; i <= times; i++) {
                    var filter1 = "/query?&where=";
                    var where = "OBJECTID>=" + ((i - 1) * 1000).toString() + "and OBJECTID<" + (i * 1000).toString();
                    var filter2 = "&text=&geometry=&geometryType=esriGeometryPoint&inSR=&spatialRel=esriSpatialRelIntersects&relationParam=&objectIds=&time=&returnCountOnly=false&returnIdsOnly=false&returnGeometry=true&maxAllowableOffset=&outSR=&outFields=*&f=pjson";
                    var filter = filter1 + where + filter2;
                    maptalks.Ajax.post({ url: requestUrl }, 'url=' + encodeURIComponent(_url) + '&filter=' + encodeURIComponent(filter), function (error, result) {
                        if (error) return;
                        var _result = maptalks.Util.parseJSON(result);
                        var featureCount = _result.features.length;
                        console.log(featureCount +":"+ that.getId());
                        that.featureCount += featureCount;
                        if (that.featureCount >= count-1) {
                            that.loadend = true;
                        }
                        var layerData = { data: _result, info: lInfo };
                        var geometries = that._addData(layerData);
                        that.geometryList = that.geometryList.concat(geometries);
                        that.addGeometry(geometries);
                    })
                }
            });
        })
    }
    _addData (layerData) {
        var geodata = null;
        if (!(layerData instanceof Object))
            return;
        if (!layerData.info.geometryType) {
            throw new Error("The layer's geometry type is unknown");
            return;
        }
        switch (layerData.info.geometryType) {
            case "esriGeometryPoint":
                geodata = this._processMarkers(layerData);
                break;
            case "esriGeometryPolygon":
                geodata = this._processPolygons(layerData);
                break;
            case "esriGeometryPolyline":
                geodata = this._processPolylines(layerData);
                break;
            default:
                break;
        }
        return geodata; 
    }
    _processMarkers (layerData) {
        this.layerData = layerData.data;
        var features = layerData.data.features;
        var drawingType;
        if (layerData.info.drawingInfo.renderer.symbol)
            drawingType = layerData.info.drawingInfo.renderer.symbol.type;
        if (layerData.info.drawingInfo.renderer.type)
            drawingType = layerData.info.drawingInfo.renderer.type;
        var _symbol;
        if (drawingType == 'esriPMS' || drawingType == 'uniqueValue') {
            _symbol = this._getPicMarkerSymbol(layerData.info.drawingInfo);
        }
        else
            _symbol = this._parseEsriSymbol(layerData.info.drawingInfo.renderer.symbol || layerData.info.drawingInfo.renderer.defaultSymbol);
        var _markers = [];
        var len = features.length;
        for (var i = 0; i < len; i++) {
            var feature = features[i];
            var marker = new maptalks.Marker([feature.geometry.x, feature.geometry.y], {
                symbol: _symbol
            });
            if (this.query == true) {
                this._setInfoWindow(marker, feature.attributes);
            }
            marker.attributes = feature.attributes;
            marker.setId(feature.attributes.OBJECTID);
            _markers.push(marker);
        }
        return _markers;
    }

    _startBreakRenderLayer(){
        if (!!this.layerData && this._examField(this.layerData.fields, this.renderAtrribute)) {
            this._breakRenderLayer(this.breakClassRender);
        }
        else {
            throw new Error("attribute you set not exist in featurelayer's fields");
        }
    }
    _processPolygons (layerData) {
        this.layerData = layerData.data;
        var features = layerData.data.features;
        var _symbol;
        if (layerData.info.drawingInfo.renderer.symbol) {
            _symbol = this._parseEsriSymbol(layerData.info.drawingInfo.renderer.symbol);
        }
        var polygons = [];
        var len=features.length;
        for(var i=0;i<len;i++){
            var feature = features[i];
            if (!feature.geometry) {
                console.log("this feature has no geometry：" + i);
                continue;
            }
            var polygon=null;
            if (layerData.info.drawingInfo.renderer.type == "classBreaks")
                polygon=new maptalks.Polygon(feature.geometry.rings, {
                    symbol:this._parseBreakSymbol(layerData.info.drawingInfo.renderer,feature.attributes)
                });
            else
                polygon= new maptalks.Polygon(feature.geometry.rings, {
                    symbol:_symbol
                });
            polygon.attributes = feature.attributes;
            var symbol = polygon.getSymbol();
            //鼠标在要素上移动时改变polygon透明度
            if (this.selected == true) {
                var oldopacity = 0;
                polygon.on('mouseover', function (g) {
                    var _target = g.target;
                    var currentopacity = _target.getSymbol().polygonOpacity;
                    oldopacity = (oldopacity < currentopacity && oldopacity != 0) ? oldopacity : currentopacity;
                    var newopacity = (currentopacity + 0.2 <= 1) ? currentopacity + 0.2 : 1;
                    var _symbol = _target.getSymbol();
                    target.updateSymbol({ polygonOpacity: newopacity });
                    _target.on('mouseout', function (_g) {
                        var _target_ = _g.target;
                        _target_.updateSymbol({ polygonOpacity: oldopacity });
                    });
                });
            }
            if (this.query == true) {
                this._setInfoWindow(polygon);
            }
            polygon.setId(feature.attributes.OBJECTID);
            polygons.push(polygon);
        }
        return polygons;
    }
    _processPolylines (layerData) {
        this.layerData = layerData.data;
        var features = layerData.data.features;
        var sym = layerData.info.drawingInfo.renderer.symbol || layerData.info.drawingInfo.renderer.defaultSymbol;
        var polylines = [];
        if(features)
            var len = features.length;
        for (var i = 0; i < len; i++) {
            var feature = features[i];
            var paths = feature.geometry.paths;
            //解析线
            var polyline = new maptalks.MultiLineString(paths, {
                symbol: {
                    'lineColor': 'rgb(' + sym.color[0] + ',' + sym.color[1] + ',' + sym.color[2] + ')',
                    'lineWidth': sym.width,
                    'lineOpacity': 1
                }
            });
            if (this.query == true) {
                this._setInfoWindow(polyline, feature.attributes);
            }
            polyline.attributes = feature.attributes;
            polyline.setId(feature.attributes.OBJECTID);
            polylines.push(polyline);
        }
        return polylines;
    }


    _examField (data, attri) {
        if (data instanceof Array&&attri) {
            for (var i = 0; i < data.length; i++) {
                if (data[i].name== attri) {
                    return true;
                    break;
                }
            }
            return false;
        }
        else {
            throw new Error("attribute you set not in featurelayer's fields");
            if (this.addGeometry) {

            }
            return false;
        }
    }

    _parseEsriSymbol (symbol) {
        var sym;
        if (!symbol) return;
        if (symbol.type == "esriSMS") {
            sym = {
                'markerType':'ellipse',
                'markerLineColor': 'rgb(' + symbol.outline.color[0] + ',' + symbol.outline.color[1]+',' +symbol.outline.color[2] + ')',
                'lineWidth': symbol.outline.width,
                'markerLineOpacity': 1,
                'markerFill': 'rgb(' + symbol.color[0] + ',' + symbol.color[1] +','+symbol.color[2] +')',
                'markerFillOpacity': 1,
                'markerWidth': symbol.size+1,
                'markerHeight': symbol.size+1
            }
            return sym;
        }
        else if (symbol.type == "esriSFS") {
            var pfill = symbol.color ? 'rgb(' + symbol.color[0] + ',' + symbol.color[1] + ',' + symbol.color[2] +symbol.color[3]+')' : "#fff";
            var pOpacity = symbol.color ? 1 : 0;
            var pOpacity;
            if (!symbol.color) pOpacity = 0;
            else if (symbol.color[0] == 0 && symbol.color[1] == 0 && symbol.color[2] == 0)
                pOpacity = 0;
            else pOpacity = 1;
            sym = {
                'lineColor': 'rgb('+symbol.outline.color[0]+','+symbol.outline.color[1]+','+symbol.outline.color[2]+symbol.outline.color[3]+')',
                'lineWidth': symbol.outline.width,
                'lineOpacity': 1,
                'polygonFill':pfill,
                'polygonOpacity': pOpacity
            }
            return sym;
        }
    }

    _parseBreakSymbol(renderer,attribute){
        if (renderer.type == 'classBreaks') {
            var symbol=null;
            var classBreakInfos = renderer.classBreakInfos;
            var field = renderer.field;
            for (var i = 0; i < classBreakInfos.length; i++) {
                if (attribute[field] < classBreakInfos[i].classMaxValue) {
                    var sym=classBreakInfos[i].symbol;
                    symbol = {
                        'polygonFill': 'rgba(' + sym.color[0] + ',' + sym.color[1] + ',' + sym.color[2] + ',' + sym.color[3] + ')',
                        'lineColor': 'rgba(' + sym.outline.color[0] + ',' + sym.outline.color[1] + ',' + sym.outline.color[2] + ',' + sym.outline.color[3] + ')',
                        'lineWidth': sym.color.width
                    }
                    return symbol;
                }
            }
        }
    }

    _getPicMarkerSymbol_ (name, uniqueValueInfos) {
        if (name&&uniqueValueInfos) {
            var len = uniqueValueInfos.length;
            for (var i = 0; i < len; i++) {
                var uniqueValue = uniqueValueInfos[i];
                if (uniqueValue.value == name) {
                    return {
                        'markerFile': this.dataUrl + "/images/" + uniqueValue.symbol.url,
                        'markerWidth': uniqueValue.symbol.width,
                        'markerHeight': uniqueValue.symbol.height,
                    };
                    break;
                }
            }
        }
    }
    _getPicMarkerSymbol (drawingInfo) {
        if (drawingInfo) {
            var symbol = drawingInfo.renderer.symbol || drawingInfo.renderer.defaultSymbol
            var _url = symbol.url;
            var _width = symbol.width;
            var _height = symbol.height;
            return {
                'markerFile': this.dataUrl + "/images/" + _url,
                'markerWidth': _width,
                'markerHeight': _height
            };
        }
    }
    setInfoWin (config) {
        var geometries = this.getGeometries();
        geometries.forEach(function (geo) {
            var attri = geo.attributes;
            var content = '<table cellspacing="5" class="gd_table" id="infoWin" style="font-family:"Microsoft YaHei";font-size:10px;">';
            for (var p in attri) {
                var c = config[p];
                if (config[p]) {
                    content += '<tr><td class="gd_table_td">' + config[p] + '</td><td>：' + attri[p] + '</td></tr>';
                }
            }
            content += '</table>';
            var options = {
                'title': '属性信息',
                'content': content,
                'width':370
            };
            this._setInfoWindow(geo, options);
        }.bind(this));
    }
    _setInfoOption (geo) {
        var attri = geo.attributes;
        var content = '<table cellspacing="5" id="infoWin" style="color:black;font-family:"Microsoft YaHei";font-size:10px;">';
        for (var p in attri) {
            if (!attri[p] || attri[p] == ""||attri[p]==0) continue;
            content += '<tr><td>' + p + '</td><td>：' + attri[p] + '</td></tr>';
        }
        content += '</table>';
        var options = {
            'title': '属性信息',
            'content': content
        };
        return options;
    }
    _setInfoWindow (geo,option) {
        var options = option || this._setInfoOption(geo);
        var infoWindow = new maptalks.ui.InfoWindow(options);
        var _infoWin = infoWindow.addTo(geo);
        geo.on('click', function (e) {
            !_infoWin.isVisible() ? _infoWin.show(e.target.getCenter()) : _infoWin.hide();
        });
    }
    _addLabel (geos) {
        var labels = [];
        geos.forEach(function (geo) {
            if (geo.label)
                labels.push(geo.label);
        });
        return labels;
    }

    _getLayerIndex (name,layers) {
        for (var i = 0; i < layers.length; i++) {
            if (name == layers[i].name) {
                return layers[i].id;
                break;
            }
        }
    }
}

FeatureLayer.registerRenderer('canvas', class extends maptalks.renderer.VectorLayerCanvasRenderer {
});