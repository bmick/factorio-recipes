import { Component, Input,
    OnInit, OnChanges, SimpleChanges, SimpleChange } from '@angular/core';
import { RecipesService } from './recipes.service';
import { Observable } from 'rxjs';
import { format as d3format, scaleOrdinal, schemeCategory10, scaleImplicit, range as d3Range } from 'd3';
import * as d3 from 'd3-selection';
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey';
import {MatMenuModule} from '@angular/material/menu';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnChanges, OnInit {
    title = 'factorio-recipes';
    recipes: Object;
    categories: Map<string, Array<Array<string>>> = new Map();
    svg;
    liquidInBarrels: boolean = false;
    @Input() selectedRecipeId: string;

    constructor( private data: RecipesService ) {}

    ngOnInit(): void {
        this.data.getRecipes().subscribe(data => this.ongetrecipes(data));
        this.svg = d3.select('svg');

    }

    ngOnChanges(changes: SimpleChanges) {
        console.log(changes);
        // const name: SimpleChange = changes.selectedRecipeId;
    }

    onrecipeselect(rid) {
        this.selectedRecipeId = rid;
        this.drawGraphFor(rid);
    }


    ongetrecipes(data) {
        this.recipes = data;

        for ( const [k, r] of Object.entries( this.recipes ) ) {
            if ( r.recipe.ingredients.length === 0 ) { continue; }

            if ( ! this.categories.has( r.type ) ) {
                this.categories.set( r.type, [] );
            }

            this.categories.get( r.type ).push([r.id, r.name]);
        }

        this.selectedRecipeId = 'atomic-bomb';
        this.drawGraphFor('atomic-bomb');
    }

    onchange(e) {
        this.drawGraphFor(this.selectedRecipeId);
    }

    drawGraphFor( recipeId ) {

        // console.group(recipeId);

        const width: number = 800;
        const height: number = 600;

        const [nodesMap, rawLinks] = this.getSourcesFor( recipeId );
        const rawNodes: Array<any> = Array.from(nodesMap.values());
        // console.debug('raw nodes', nodes);
        // console.debug('raw links', links);

        const scale = scaleOrdinal(
        //    d3Range(15).map( i => return interpolateSinebow(i/15) )
            schemeCategory10
        );
        scale.unknown( scaleImplicit );
        const color = name => scale(name.replace(/ .*/, ''));
        const format = d3format('.2s');
        const sankeyDiagram = d3Sankey()
            .nodeId( d => d.id )
            // .iterations(100)
            .extent( [[1, 1], [width - 1, height - 5]] )
            .nodes(rawNodes)
            .links(rawLinks);

        const {links, nodes} = sankeyDiagram();

        // console.debug('result nodes', nodes);
        // console.debug('result links', links);
        // console.groupEnd();
        this.svg.selectAll('*').remove();
        this.svg.attr('viewBox', `0 0 ${width} ${height}`);
        const link = this.svg.append('g')
            .attr('fill', 'none')
            .attr('stroke', '#000')
            .attr('stroke-opacity', 0.2)
        .selectAll('path')
        .data(links)
        .enter().append('path')
            .attr('stroke', d => color(d.source.name))
            .attr('d', sankeyLinkHorizontal())
            .attr('stroke-width', function(d) { return d.width; });

        link.append('title')
            .text(d => `${d.source.name} → ${d.target.name}\n${format(d.value)}`);

        const node = this.svg.append('g')

        .selectAll('rect')
        .data(nodes)
        .enter()
            .append('g');

        node.append('rect')
                .attr('stroke', '#222')
                .attr('x', d => d.x0)
                .attr('y', d => d.y0)
                .attr('height', d => d.y1 - d.y0)
                .attr('width', d => d.x1 - d.x0)
                .attr('fill', d => color(d.name))
            .append('title')
                .text(d => `${d.name}\ninput ${format(d.value)} items per second`)
        ;

        node.append('text')
            .attr('fill', d => color(d.name))
            .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr('y', d => (d.y1 + d.y0) / 2)
            .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
            .attr('dy', '0.35em')
            .text( d => d.name )
        ;

        node.append('image')
            .attr('xlink:href', d => `assets/factorio-content/${d.id}.png`)
            .attr('width', 32)
            .attr('height', 32)
            .attr('x', d => (d.x1 + d.x0)  / 2 - 16)
            .attr('y', d => (d.y1 + d.y0) / 2 - 16)


    }

    // return nodes, links
    getSourcesFor( recipeId ): [Map<string, any>, any[]] {
        const nodes = new Map<string, any>();
        const links = [];
        // console.group(recipeId);
        nodes.set(recipeId, {id: recipeId, name: this.recipes[recipeId].name});

        for ( const ingr of this.recipes[recipeId].recipe.ingredients ) {

            // nodes.set(ingr.id, {id: ingr.id, name: this.recipes[ingr.id].name});

            let value = ingr.amount / this.recipes[recipeId].recipe.yield;
            if ( this.liquidInBarrels && this.recipes[ingr.id].type == "Liquid" ) {
                value /= 50.0 ; // liters in barrel
            }

            links.push( {
                source: ingr.id , target: recipeId,
                value: value
            } );
            const [childNodes, childLinks] : [Map<string, any>, any[]] = this.getSourcesFor(ingr.id);

            childNodes.forEach( (v, k): Map<string, any> => nodes.set(k, v) );

            for ( const chL of childLinks ) { // sum

                chL.value *= value;

                const found = links.find( el => el.source === chL.source && el.target === chL.target );
                if ( !!found ) {
                    found.value += chL.value;
                } else {
                    links.push( chL );
                }
            }
        }
        // console.debug(nodes, recipeId);

        // console.groupEnd();

        return [nodes, links];
    }
}
