import pymysql

# 使用 PyMySQL 兼容 Django 的 MySQLdb 接口，降低本地安装 mysqlclient 的门槛。
pymysql.install_as_MySQLdb()
