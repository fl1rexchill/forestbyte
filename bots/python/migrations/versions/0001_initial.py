"""initial: текущая схема (без изменений) — ядро + модули.

Ядро (core/database/models.py): users, message_logs, broadcast_jobs, settings.
Модули: payments, shop_products/shop_orders/shop_order_items,
support_tickets/support_messages, scheduled_posts.

Сгенерировано `alembic revision --autogenerate` на пустой БД и сверено с моделями.
БД, уже созданная через init_db() (create_all), помечается командой `alembic stamp 0001`.

Revision ID: 0001
Revises:
Create Date: 2026-09-12 17:52:05.774908
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('broadcast_jobs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_by', sa.BigInteger(), nullable=False),
    sa.Column('platform', sa.String(length=20), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('total', sa.Integer(), nullable=False),
    sa.Column('sent', sa.Integer(), nullable=False),
    sa.Column('failed', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('scheduled_posts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_by', sa.BigInteger(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('target', sa.String(length=64), nullable=False),
    sa.Column('run_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('scheduled_posts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_scheduled_posts_run_at'), ['run_at'], unique=False)

    op.create_table('settings',
    sa.Column('key', sa.String(length=100), nullable=False),
    sa.Column('value', sa.Text(), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('key')
    )
    op.create_table('shop_products',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('price_stars', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('platform', sa.String(length=20), nullable=False),
    sa.Column('external_id', sa.BigInteger(), nullable=False),
    sa.Column('username', sa.String(length=255), nullable=True),
    sa.Column('first_name', sa.String(length=255), nullable=True),
    sa.Column('last_name', sa.String(length=255), nullable=True),
    sa.Column('language_code', sa.String(length=10), nullable=True),
    sa.Column('referred_by', sa.BigInteger(), nullable=True),
    sa.Column('is_admin', sa.Boolean(), nullable=False),
    sa.Column('is_banned', sa.Boolean(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_users_external_id'), ['external_id'], unique=False)
        batch_op.create_index('ix_users_platform_external', ['platform', 'external_id'], unique=True)

    op.create_table('message_logs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('platform', sa.String(length=20), nullable=False),
    sa.Column('text', sa.Text(), nullable=True),
    sa.Column('content_type', sa.String(length=30), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('message_logs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_message_logs_created_at'), ['created_at'], unique=False)

    op.create_table('payments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('currency', sa.String(length=10), nullable=False),
    sa.Column('payload', sa.String(length=255), nullable=False),
    sa.Column('telegram_charge_id', sa.String(length=255), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('shop_orders',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('total_stars', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('support_tickets',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('shop_order_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=True),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('price_stars', sa.Integer(), nullable=False),
    sa.Column('qty', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['order_id'], ['shop_orders.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['product_id'], ['shop_products.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('support_messages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('ticket_id', sa.Integer(), nullable=False),
    sa.Column('from_admin', sa.Boolean(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['ticket_id'], ['support_tickets.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('support_messages')
    op.drop_table('shop_order_items')
    op.drop_table('support_tickets')
    op.drop_table('shop_orders')
    op.drop_table('payments')
    with op.batch_alter_table('message_logs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_message_logs_created_at'))

    op.drop_table('message_logs')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index('ix_users_platform_external')
        batch_op.drop_index(batch_op.f('ix_users_external_id'))

    op.drop_table('users')
    op.drop_table('shop_products')
    op.drop_table('settings')
    with op.batch_alter_table('scheduled_posts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_scheduled_posts_run_at'))

    op.drop_table('scheduled_posts')
    op.drop_table('broadcast_jobs')

