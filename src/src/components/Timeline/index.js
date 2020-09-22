import React from 'react'
import BaseComponent from '../../HOC/BaseComponent'
import $ from 'jquery'
import moment from 'moment'
import {
  Bar,
  Brush,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  ComposedChart,
} from 'recharts'

import './styles.scss'
import { timelineData } from '../../boot/timelineBoot'

class Timeline extends BaseComponent {
  constructor(props) {
    super(props)

    this._parentElem = null
    this._showAxis = false
  }

  // get isTimeMachineEnabled() {
  //   return this.sharedState.get('time_machine_enabled')
  // }

  // get timeMachineDate() {
  //   return this.sharedState.get('time_machine_target_date')
  // }

  // get actualDateFrom() {
  //   return this.sharedState.get('time_machine_actual_date_from')
  // }

  // get actualDateTo() {
  //   return this.sharedState.get('time_machine_actual_date_to')
  // }

  // get dateFrom() {
  //   return this.sharedState.get('time_machine_date_from')
  // }

  // get dateTo() {
  //   return this.sharedState.get('time_machine_date_to')
  // }

  // get durationHrs() {
  //   return this.sharedState.get('time_machine_duration')
  // }

  // get timelineData() {
  //   var data = this.sharedState.get('time_machine_timeline_data')
  //   if (!data) {
  //     return []
  //   }
  //   return data
  // }

  // setupView() {
  //   const time_machine_date_to = this.sharedState.get('time_machine_date_to')
  //     ? new Date(this.sharedState.get('time_machine_date_to'))
  //     : new Date()
  //   const time_machine_duration = this.sharedState.get('time_machine_duration')
  //     ? Number(this.sharedState.get('time_machine_duration'))
  //     : 24
  //   const time_machine_enabled = this.sharedState.get('time_machine_enabled')
  //     ? this.sharedState.get('time_machine_enabled')
  //     : false
  //   const time_machine_date = this.sharedState.get('time_machine_date')
  //     ? this.sharedState.get('time_machine_date')
  //     : null
  //   const time_machine_target_date = this.sharedState.get(
  //     'time_machine_target_date'
  //   )
  //     ? this.sharedState.get('time_machine_target_date')
  //     : null

  //   this.sharedState.set('time_machine_date_to', time_machine_date_to)
  //   this.sharedState.set('time_machine_duration', time_machine_duration)
  //   this.sharedState.set('time_machine_enabled', time_machine_enabled)
  //   this.sharedState.set('time_machine_date', time_machine_date)
  //   this.sharedState.set('time_machine_target_date', time_machine_target_date)
  // }

  _setup() {
    $(document).on('layout-resize-timelineComponent', () => {
      this._setupDimentions()
    })

    this._setupDimentions()
  }

  _setupDimentions(size) {
    if (!size) {
      size = this._parentElem.node().getBoundingClientRect()
    }

    var margin = this._getMargin()

    this._width = size.width - margin.left - margin.right
    this._height = size.height - margin.top - margin.bottom
  }

  _getMargin() {
    var margin = {
      top: 10,
      right: 15,
      bottom: 25,
      left: 15,
    }

    if (this._showAxis) {
      margin.left += 40
      margin.lerightft += 40
    }

    return margin
  }

  // toggleTimeMachine() {
  //   this.sharedState.set(
  //     'time_machine_enabled',
  //     !this.sharedState.get('time_machine_enabled')
  //   )
  //   if (this.sharedState.get('time_machine_enabled')) {
  //     this.sharedState.set(
  //       'time_machine_target_date',
  //       this.sharedState.get('time_machine_date_to')
  //     )
  //     this.sharedState.set(
  //       'time_machine_date',
  //       this.sharedState.get('time_machine_date_to')
  //     )
  //   } else {
  //     this.sharedState.set('time_machine_target_date', null)
  //     this.sharedState.set('time_machine_date', null)
  //   }
  // }

  _formatXaxis(item) {
    return moment(item).format('MMM DD hh:mm A')
  }

  _customTooltip({ active, payload, label }) {
    if (active) {
      return (
        <div
          className="custom-tooltip"
          style={{
            backgroundColor: 'white',
            color: '#9b6565',
            padding: '0 10px',
          }}
        >
          <p className="label">{moment(label).format('MMM DD hh:mm:ss A')}</p>
          <p className="value">Items: {payload[0].value}</p>
        </div>
      )
    }
  }

  render() {
    return (
      <div id="timelineComponent" className="timeline size-to-parent">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={timelineData}
            margin={{
              top: 10,
              bottom: 10,
            }}
          >
            <XAxis
              dataKey="date"
              tickFormatter={this._formatXaxis}
              minTickGap={100}
              tickSize={15}
            />
            <YAxis tick={false} />
            <Tooltip
              labelStyle={{ color: '#9b6565' }}
              itemStyle={{ color: '#9b6565' }}
              contentStyle={{ color: '#9b6565' }}
              content={this._customTooltip}
            />
            <Brush
              dataKey="date"
              height={30}
              stroke="#9b6565"
              startIndex={timelineData.length - 200}
              tickFormatter={this._formatXaxis}
              gap={5}
              tick={true}
            >
              <AreaChart data={timelineData}>
                <Area
                  dataKey="items"
                  fill="#aaa"
                  fillOpacity="1"
                  stroke="none"
                  type="step"
                />
              </AreaChart>
            </Brush>
            <Bar
              dataKey="items"
              fill="#fff"
              stroke="#9b6565"
              background={{ fill: '#9b6565', fillOpacity: '1' }}
            />
            <Area
              dataKey="items"
              fill="#fff"
              fillOpacity="1"
              stroke="none"
              type="step"
              activeDot={{ stroke: '#9b6565', fill: '#ccc' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    )
  }
}

export default Timeline
