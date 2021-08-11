folder='vendor/matrix-platform/backend-adminlte'

cp -R ${folder}/www .

rm -rf www/adminlte
mkdir -p www/adminlte
cp -R vendor/almasaeed2010/adminlte/{dist,plugins} www/adminlte

touch www/css/backend-custom.css

for path in $(cat ${folder}/doc/gitignore) ; do
    grep -qxF "$path" .gitignore || echo "$path" >> .gitignore
done
