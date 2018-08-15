import React from 'react';
import { Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';

class RewardRow extends React.Component {
  render() {
    return (
      <Row key={this.props.reward.id}>
        <Col md={12}>
          <Link to={`/reward/${this.props.reward.id}`}>{this.props.reward.metadata.name || 'n/a'}</Link>
          &nbsp;
          <span>cost: {this.props.reward.cost} "{this.props.reward.tag}" karma</span>
          &nbsp;
          { this.props.showAvailable &&
          <span>, {this.props.reward.quantity} available</span> }
        </Col>
      </Row>
    );
  }
}

export default RewardRow;