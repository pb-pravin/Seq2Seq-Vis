import * as d3 from "d3";
import {VComponent} from "../vis/VisualComponent";
import {WordLine} from "../vis/WordLine";
import {AttentionVis} from "../vis/AttentionVis";
import {BarList} from "../vis/BarList";
import {StateVis} from "../vis/StateVis";
import {CloseWordList} from "../vis/CloseWordList";
import {PanelController} from "./PanelController";
import {WordProjector} from "../vis/WordProjector";
import {SimpleEventHandler} from "../etc/SimpleEventHandler";
import {D3Sel, LooseObject} from "../etc/LocalTypes";
import * as _ from "lodash";
import {NeighborStates} from "../vis/NeighborStates";
import {StateProjector} from "../vis/StateProjector";
import {StatePictograms} from "../vis/StatePictograms";


type VisColumn<DW=WordLine> = {
    // encoder_extra: VComponent<any>[],
    encoder_states: NeighborStates,
    encoder_words: WordLine,
    attention: AttentionVis,
    decoder_words: DW,
    context: NeighborStates,
    decoder_states: NeighborStates,
    // decoder_extra: VComponent<any>[],
    selection: D3Sel
}

function initPanel<T=WordLine>(select): VisColumn<T> {
    return {
        selection: select,
        // encoder_extra: [],
        encoder_states: null,
        encoder_words: null,
        attention: null,
        decoder_words: null,
        context: null,
        decoder_states: null,
        // decoder_extra: []
    }
};


export class InfoPanel {
    private infoPanel: D3Sel;
    private tgt: D3Sel;
    private src: D3Sel;

    constructor(private parent: D3Sel) {
        parent.html('<div class="info_panel">' +
            // '<div class="src"></div>' +
            // '<div class="tgt"></div>' +
            '</div>')

        this.infoPanel = parent.select('.info_panel')
        // this.src = parent.select('.src');
        // this.tgt = parent.select('.tgt');
    }


    cleanData(s: string) {
        return s.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(new RegExp('--\\|'), '<span class="highlight">')
            .replace(new RegExp('\\|--'), '</span>')
    }

    setTrans(translations: { src: string, tgt: string }[]) {

        let tSel = this.infoPanel.selectAll(".translation").data(translations);
        tSel.exit().remove();

        const tEnter = tSel.enter().append('div').attr('class', 'translation');
        tEnter.html('<div class="src"></div><div class="tgt"></div>');

        tSel = tEnter.merge(tSel);
        tSel.select('.src').html(d => this.cleanData(d.src));
        tSel.select('.tgt').html(d => this.cleanData(d.tgt));


    }

}


export class PanelManager {


    private _current = {
        topN: <number> 0,
        hideStates: <boolean> false,
        box_width: <number> 40,
        wordProjector: <WordProjector> null,
        closeWordsList: <CloseWordList> null,
        hasMediumPanel: <boolean> false,
        infoPanel: <InfoPanel>null,
    };

    private _vis = {
        zero: <VisColumn<BarList>> initPanel(d3.select('.col0')),
        left: initPanel(d3.select('.col1')),
        middle: initPanel(d3.select('.col3')),
        right: initPanel(d3.select('.col5')),
        middle_extra: <VisColumn<BarList>> initPanel(d3.select('.col2')),
        right_extra: initPanel(d3.select('.col4')),
        projectors: this._createProjectorPanel(),
        statePicto: <StatePictograms> null // initialized in init.. requires projectors
    };

    panels = {
        projectorSelect: this._createProjectorOptions()
    }

    get vis() {
        return this._vis;
    }


    constructor(private eventHandler: SimpleEventHandler) {
        this.init();
    }


    init() {

        this.buildFullStack(this._vis.left);

        this._vis.statePicto = this._createStatePictoPanel();

        // Zero

        this.buildDecorators(this._vis.zero);

    }

    _createStatePictoPanel() {
        return new StatePictograms(d3.select('#statePictos'),
            this._vis.projectors, this.eventHandler)
    }

    _createProjectorPanel() {
        const parent = d3.select('#projectorPanel').append('svg').attrs({
            width: 500,
            height: 30
        });

        return new StateProjector(parent, this.eventHandler, {})


    }

    public getMediumPanel() {
        if (!this._current.hasMediumPanel) {
            this.buildFullStack(this._vis.middle);
            // this.buildDecorators(this._vis.middle_extra);
            this._current.hasMediumPanel = true;
        }


        return {main: this._vis.middle, extra: this._vis.middle_extra};
    }

    public removeMediumPanel() {
        if (this._current.hasMediumPanel) {
            //todo: check if this works...
            this._vis.middle_extra.selection.selectAll("*").remove();
            this._vis.middle_extra = initPanel(this._vis.middle_extra.selection);
            this._vis.middle.selection.selectAll("*").remove();
            this._vis.middle = initPanel(this._vis.middle.selection);
            this._current.hasMediumPanel = false;
        }

    }


    private buildDecorators(visColumn: VisColumn<BarList>) {
        // visColumn.encoder_extra.push(PanelManager._setupPanel({
        //     col: visColumn.selection,
        //     className: "encoder_states_setup",
        //     addSVG: false,
        //     title: 'Enc states: ',
        //     divStyles: {height: '100px', width: '100px', 'padding-top': '5px'}
        // }));

        visColumn.encoder_states = PanelManager._setupPanel({
            col: visColumn.selection,
            className: "encoder_states_setup",
            addSVG: false,
            title: 'Enc states: ',
            divStyles: {height: '21px', width: '100px', 'padding-top': '0px'}
        })

        visColumn.encoder_words = PanelManager._setupPanel({
            col: visColumn.selection,
            className: "encoder_words_setup",
            addSVG: false,
            title: 'Enc words: ',
            divStyles: {height: '21px', width: '100px', 'padding-top': '5px'}
        })

        visColumn.attention = PanelManager._setupPanel({
            col: visColumn.selection,
            className: "attn_setup",
            addSVG: false,
            title: 'Attention: ',
            divStyles: {height: '50px', width: '100px'}
        })

        // noinspection JSUnresolvedVariable
        visColumn.decoder_words = this._createScoreVis({
            col: visColumn.selection,
            className: "decoder_words_setup",
            divStyles: {
                height: '21px',
                width: '100px',
                'padding-bottom': '5px'
            },
            options: {
                bar_height: 20,
                data_access: d => [d.scores[this._current.topN]],
                data_access_all: d => d.scores
            }
        })

        visColumn.encoder_states = PanelManager._setupPanel({
            col: visColumn.selection,
            className: "decoder_states_setup",
            addSVG: false,
            title: 'Dec states: ',
            divStyles: {height: '21px', width: '100px', 'padding-top': '0px'}
        })
        visColumn.context = PanelManager._setupPanel({
            col: visColumn.selection,
            className: "context_setup",
            addSVG: false,
            title: 'Context states: ',
            divStyles: {height: '21px', width: '100px', 'padding-top': '5px'}
        })

        // visColumn.decoder_extra.push(PanelManager._setupPanel({
        //     col: visColumn.selection,
        //     className: "decoder_states_setup",
        //     addSVG: false,
        //     title: 'Dec states: ',
        //     divStyles: {
        //         height: '100px',
        //         width: '100px',
        //         'padding-bottom': '5px'
        //     }
        // }))
        //
        // visColumn.decoder_extra.push(this._createScoreVis({
        //     col: visColumn.selection,
        //     className: "decoder_words_setup",
        //     divStyles: {width: '100px', 'padding-top': '5px'},
        //     options: {
        //         bar_height: 23,
        //         data_access: d => d.scores.filter((_, i) => i !== this._current.topN),
        //         data_access_all: null
        //     }
        // }))
    }

    private buildFullStack(visColumn: VisColumn) {
        // visColumn.encoder_extra.push(this._createStatesVis({
        //     col: visColumn.selection,
        //     className: 'states_encoder',
        //     divStyles: {'padding-top': '5px'},
        //     options: {
        //         data_access: d => d.encoder.map(e => _.isArray(e.state) ? e.state : []),// TODO: fix hack !!!
        //         hidden: this._current.hideStates,
        //         height: 100,
        //         cell_width: this._current.box_width
        //     }
        // }));

        visColumn.encoder_states = this._createNeighborStates({
            col: visColumn.selection,
            className: 'encoder_state_neighbors',
            options: {
                box_width: this._current.box_width
            }
        });

        visColumn.encoder_words = this._createWordLine({
            col: visColumn.selection,
            className: 'encoder_words',
            divStyles: {'padding-top': '5px'},
            options: {
                box_type: this._current.hideStates ? WordLine.BoxType.flow : WordLine.BoxType.fixed,
                box_width: this._current.box_width
            }
        });

        visColumn.attention = this._createAttention({
            col: visColumn.selection,
            className: 'attn_vis',
            options: {}
        });

        visColumn.decoder_words = this._createWordLine({
            col: visColumn.selection,
            className: 'decoder_words',
            divStyles: {'padding-bottom': '5px'},
            options: {
                box_width: this._current.box_width,
                box_type: this._current.hideStates ? WordLine.BoxType.flow : WordLine.BoxType.fixed,
                css_class_main: 'outWord',
                // data_access: d => d.decoder.length ? [d.decoder[this._current.topN]] : []
            }
        });

        visColumn.decoder_states = this._createNeighborStates({
            col: visColumn.selection,
            className: 'decoder_state_neighbors',
            divStyles: {'padding-bottom': '5px'},
            options: {
                box_width: this._current.box_width
            }
        });
        visColumn.context = this._createNeighborStates({
            col: visColumn.selection,
            className: 'context_state_neighbors',

            options: {
                box_width: this._current.box_width
            }
        });


        const partial_diff = (x) => {
            const y = x.map(e => _.isArray(e.cstar) ? e.cstar : [])

            // diff:
            // for (let i = 0; i < y.length - 1; i++) {
            //     y[i] = y[i + 1].map((yd, yi) => Math.abs(yd - y[i][yi]))
            // }
            // y[y.length - 1] = y[0].map(() => 0)


            return y;

        }


        // visColumn.decoder_extra.push(this._createStatesVis({
        //     col: visColumn.selection,
        //     className: 'states_decoder',
        //     divStyles: {'padding-bottom': '5px'},
        //     options: {
        //         data_access: d =>
        //             (d.decoder.length > this._current.topN) ?
        //                 partial_diff(d.decoder[this._current.topN])
        //                 // d.decoder[this._current.topN]
        //                 //     .map(e => _.isArray(e.cstar) ? e.cstar : [])
        //                 : [[]], // TODO: fix hack !!!
        //         hidden: this._current.hideStates,
        //         height: 100,
        //         cell_width: this._current.box_width
        //     }
        // }));
        //
        // visColumn.decoder_extra.push(this._createWordLine({
        //     col: visColumn.selection,
        //     className: 'decoder_topK',
        //     divStyles: {'padding-top': '5px'},
        //     options: {
        //         css_class_main: 'topKWord',
        //         data_access: d => d.decoder.filter((_, i) => i !== this._current.topN)
        //     }
        // }))
    }

    static _setupPanel({col, className, divStyles, addSVG = true, title = <string> null}) {
        const div = col
            .append('div').attr('class', 'setup ' + className).styles(divStyles)
        // .style('background', 'lightgray');
        if (title) {
            div.html(title);
        }
        if (addSVG) return div.append('svg').attrs({width: 100, height: 30})
            .styles({
                display: 'inline-block'
            });
        else return div;
    }

    _createScoreVis({col, className, options, divStyles}) {
        const svg = PanelManager._setupPanel({
            col,
            className,
            divStyles,
            addSVG: true
        });

        return new BarList(svg, this.eventHandler, options)
    }


    static _standardSVGPanel({col, className, divStyles}) {
        return col
            .append('div').attr('class', className).styles(divStyles)
            .append('svg').attrs({width: 500, height: 30});
    }


    _createStatesVis({col, className, options, divStyles}) {
        const svg = PanelManager._standardSVGPanel({col, className, divStyles});

        return new StateVis(svg, this.eventHandler, options);
    }

    _createNeighborStates({col, className, options, divStyles = {}}) {
        const svg = PanelManager._standardSVGPanel({col, className, divStyles});

        return new NeighborStates(svg, this.eventHandler, options)
    }


    _createAttention({col, className, options, divStyles = null}) {
        const svg = PanelManager._standardSVGPanel({col, className, divStyles});

        return new AttentionVis(svg, this.eventHandler, options)
    }

    _createWordLine({col, className, options, divStyles}) {
        const svg = PanelManager._standardSVGPanel({col, className, divStyles});

        return new WordLine(svg, this.eventHandler, options)
    }

    _createWordProjector({col, className, options, divStyles}) {
        const svg = PanelManager._standardSVGPanel({col, className, divStyles});

        return new WordProjector(svg, this.eventHandler, options)
    }

    _createCloseWordList({col, className, options, divStyles}) {
        const svg = PanelManager._standardSVGPanel({col, className, divStyles});

        return new CloseWordList(svg, this.eventHandler, options)
    }


    getWordProjector() {
        if (this._current.wordProjector === null) {
            this.closeAllRight();
            this._current.wordProjector = this._createWordProjector({
                col: this._vis.right.selection,
                className: "word_projector",
                divStyles: {'padding-top': '105px'},
                options: {}
            })
        }

        return this._current.wordProjector;
    }


    getInfoPanel() {
        if (this._current.infoPanel === null) {
            this.closeAllRight();
            this._current.infoPanel = new InfoPanel(this._vis.right.selection);
        }
        return this._current.infoPanel

    }


    closeAllRight() {
        // if (this._current.wordProjector) {
        this._vis.right.selection.selectAll('*').remove();
        this._vis.right = initPanel(this._vis.right.selection);
        this._current.wordProjector = null;
        this._current.infoPanel = null;
        // }
    }


    getWordList() {
        if (this._current.closeWordsList === null) {
            this._current.closeWordsList = this._createCloseWordList({
                col: this._vis.right.selection,
                className: "close_word_list",
                divStyles: {'padding-top': '10px'},
                options: {}
            })
        }

        return this._current.closeWordsList;
    }

    _createProjectorOptions() {
        return d3.select('#projectorSelect')
        // .on('change', ()=>{
        //     const v = d3.select('#projectorSelect').property('value')
        //     console.log(v,"--- ");
        // })
    }

    updateProjectionSelectField(options: string[], defaultOption = null) {
        const op = this.panels.projectorSelect
            .selectAll('option').data(options);
        op.exit().remove();
        op.enter().append('option')
            .merge(op)
            // .attr('selected', d => (d === defaultOption) ? true : null)
            .attr('value', d => d)
            .text(d => d)

        if (defaultOption) this.panels.projectorSelect.property('value', defaultOption)

    }


}
