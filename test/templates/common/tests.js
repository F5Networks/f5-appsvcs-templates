const monitorTests = {
    run: (util, template, view, expected, customAttrs, existingMonitor) => {
        describe('use existing monitor', () => {
            before(() => {
                customAttrs.forEach(attr => delete view[attr]);
                view.make_monitor = false;
                view.monitor_name = existingMonitor;
                expected.t1.app1.app1_pool.monitors = [{ bigip: view.monitor_name }];
                delete expected.t1.app1.app1_monitor;
            });
            util.assertRendering(template, view, expected);
        });

        describe('no monitor', () => {
            before(() => {
                delete view.monitor_name;
                view.enable_monitor = false;
                delete expected.t1.app1.app1_pool.monitors;
            });
            util.assertRendering(template, view, expected);
        });
    }
};
const poolTests = {
    run: (util, template, view, expected) => {
        describe('use existing pool', () => {
            before(() => {
                delete view.pool_members;
                delete view.load_balancing_mode;
                delete view.slow_ramp_time;
                view.make_pool = false;
                view.pool_name = '/Common/pool1';
                expected.t1.app1.app1.pool = { bigip: '/Common/pool1' };
                delete expected.t1.app1.app1_pool;
            });
            util.assertRendering(template, view, expected);
        });

        describe('no pool', () => {
            before(() => {
                delete view.pool_name;
                view.enable_pool = false;
                delete expected.t1.app1.app1.pool;
            });
            util.assertRendering(template, view, expected);
        });
    }
};

module.exports = { monitorTests, poolTests };
