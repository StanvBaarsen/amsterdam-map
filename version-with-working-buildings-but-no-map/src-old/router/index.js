import Vue from 'vue';
import Router from 'vue-router';
import ThreeViewer from '@/pages/Viewer';

Vue.use( Router );

const router = new Router( {
	linkActiveClass: "is-active",
	mode: 'history',
	routes: [
		{
			path: '/',
			name: 'Viewer',
			component: ThreeViewer
		}
	],

	scrollBehavior: function ( to ) {

		if ( to.hash ) {

			return {
				selector: to.hash
			};

		} else {

			return { x: 0, y: 0 };

		}

	}
} );

export default router;
