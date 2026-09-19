"""Alert schemas for notifications and outbreak detection."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel
from app.models.alert import AlertSeverity, AlertType


class AlertRead(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    target_role: Optional[str] = None
    bovine_id: Optional[uuid.UUID] = None
    complaint_id: Optional[uuid.UUID] = None
    title: str
    message: str
    alert_type: AlertType
    severity: AlertSeverity
    is_read: bool
    data_json: Optional[str] = None
    created_at: datetime


class AlertsListResponse(BaseModel):
    alerts: List[AlertRead]
    unread_count: int


class PushTokenRegister(BaseModel):
    push_token: str  # ExponentPushToken[...]


class OutbreakCluster(BaseModel):
    village_or_place: str
    case_count: int
    severity: str
    affected_cow_ids: List[str]
    alert_triggered: bool
    latest_incident_at: datetime
